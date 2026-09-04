import { prisma } from '@/lib/db'
import { sendBookingReminder } from '@/lib/notifications'

/** A séma szerinti legnagyobb emlékeztető-előretartás (14 nap). */
const MAX_REMINDER_HOURS = 24 * 14

/**
 * Milyen sűrűn fut ez a végpont (órában). A Vercel Hobby csomagján a cron
 * naponta egyszer indulhat, ezért az alapérték 24. Ha Pro csomagra váltasz és
 * sűrűbb ütemezést állítasz be a `vercel.json`-ban, állítsd át ezt a
 * környezeti változót is — ebből számoljuk, meddig kell előre néznünk.
 */
const CRON_INTERVAL_HOURS = Number(process.env.CRON_INTERVAL_HOURS ?? 24)

const HOUR_MS = 60 * 60 * 1000

/**
 * Emlékeztető e-mailek kiküldése. A Vercel Cron hívja (lásd `vercel.json`).
 *
 * **Miért nézünk előre?** Ha csak a már esedékes emlékeztetőket küldenénk ki,
 * a ritkán futó cron egyszerűen átugraná őket: egy „1 órával előtte"
 * emlékeztető sosem lenne esedékes pont akkor, amikor a napi futás történik,
 * és mire legközelebb lefutna, az esemény már elmúlt. Ezért mindent kiküldünk,
 * ami a *következő futásig* esedékessé válik. Így az emlékeztető inkább kicsit
 * korábban megy ki, mint hogy egyáltalán ne menjen.
 *
 * A művelet idempotens: a `reminderSentAt` mezőt még a küldés előtt
 * lefoglaljuk egy feltételes írással, így két egyszerre futó cron sem tud
 * ugyanarra a foglalásra két levelet küldeni.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET

  if (secret) {
    const authorization = request.headers.get('authorization')

    if (authorization !== `Bearer ${secret}`) {
      return Response.json({ error: 'Nincs jogosultság.' }, { status: 401 })
    }
  }

  const now = new Date()
  const lookaheadMs = Math.max(0, CRON_INTERVAL_HOURS) * HOUR_MS
  // A jelöltek közé az is beleférhet, ami csak a következő futásig válik
  // esedékessé, ezért a leghosszabb előretartáson felül a futási közt is
  // hozzáadjuk.
  const horizon = new Date(now.getTime() + MAX_REMINDER_HOURS * HOUR_MS + lookaheadMs)

  const candidates = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED',
      reminderSentAt: null,
      startsAt: { gt: now, lte: horizon },
      eventType: { reminderHoursBefore: { not: null } },
    },
    select: {
      id: true,
      startsAt: true,
      eventType: { select: { reminderHoursBefore: true } },
    },
    orderBy: { startsAt: 'asc' },
    take: 200,
  })

  // Az „ennyi órával előtte" küszöb eseményenként más, ezért itt szűrünk.
  const due = candidates.filter((booking) => {
    const hours = booking.eventType.reminderHoursBefore
    if (hours === null) return false

    const dueAt = booking.startsAt.getTime() - hours * HOUR_MS

    return dueAt <= now.getTime() + lookaheadMs
  })

  let sent = 0
  let failed = 0

  for (const booking of due) {
    // Lefoglaljuk a küldés jogát: csak az nyer, aki a null → dátum írást elvégzi.
    const claimed = await prisma.booking.updateMany({
      where: { id: booking.id, reminderSentAt: null, status: 'CONFIRMED' },
      data: { reminderSentAt: new Date() },
    })

    if (claimed.count === 0) continue

    try {
      await sendBookingReminder(booking.id)
      sent += 1
    } catch (error) {
      console.error(`[cron] Emlékeztető küldése sikertelen (${booking.id}):`, error)
      failed += 1
    }
  }

  return Response.json({
    checked: candidates.length,
    due: due.length,
    sent,
    failed,
    lookaheadHours: CRON_INTERVAL_HOURS,
  })
}
