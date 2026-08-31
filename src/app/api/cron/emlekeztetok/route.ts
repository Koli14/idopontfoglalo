import { prisma } from '@/lib/db'
import { sendBookingReminder } from '@/lib/notifications'

/** A séma szerinti legnagyobb emlékeztető-előretartás (14 nap). */
const MAX_REMINDER_HOURS = 24 * 14

/**
 * Emlékeztető e-mailek kiküldése. A Vercel Cron óránként hívja.
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
  const horizon = new Date(now.getTime() + MAX_REMINDER_HOURS * 60 * 60 * 1000)

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

  // Az "ennyi órával előtte" küszöb eseményenként más, ezért itt szűrünk.
  const due = candidates.filter((booking) => {
    const hours = booking.eventType.reminderHoursBefore
    if (hours === null) return false

    return booking.startsAt.getTime() - hours * 60 * 60 * 1000 <= now.getTime()
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

  return Response.json({ checked: candidates.length, due: due.length, sent, failed })
}
