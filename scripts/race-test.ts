/**
 * Versenyhelyzet-teszt: ugyanarra az időpontra egyszerre indított foglalások
 * közül pontosan egynek szabad sikerülnie.
 *
 * Futtatás (fut a helyi adatbázis és a seed):
 *   pnpm tsx scripts/race-test.ts
 */
import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { createBooking, cancelBooking } from '../src/lib/booking'
import { availableSlots, generateSlots } from '../src/lib/slots'
import { formatTime } from '../src/lib/time'

const CONCURRENCY = 8
let failures = 0

function check(label: string, passed: boolean, detail = '') {
  console.log(`${passed ? '  ok  ' : ' FAIL '} ${label}${detail ? ` — ${detail}` : ''}`)
  if (!passed) failures += 1
}

async function loadSlots(eventTypeId: string) {
  const eventType = await prisma.eventType.findUniqueOrThrow({ where: { id: eventTypeId } })
  const windows = await prisma.availabilityWindow.findMany({ where: { eventTypeId } })
  const bookings = await prisma.booking.findMany({
    where: { eventTypeId, status: 'CONFIRMED' },
    select: { startsAt: true, endsAt: true },
  })

  return {
    eventType,
    slots: generateSlots({ eventType, windows, bookings, now: new Date() }),
  }
}

async function main() {
  const eventType = await prisma.eventType.findUniqueOrThrow({ where: { slug: 'konzultacio' } })

  // Tiszta lappal indulunk.
  await prisma.booking.deleteMany({ where: { eventTypeId: eventType.id } })

  // --- 1. Egyidejű foglalás ugyanarra az időpontra ---
  const first = await loadSlots(eventType.id)
  const target = availableSlots(first.slots)[0]

  if (!target) throw new Error('Nincs szabad időpont — futtasd a seedet.')

  console.log(
    `\nCél időpont: ${target.startsAt.toISOString()} (${formatTime(target.startsAt, eventType.timezone)} helyi idő)`,
  )
  console.log(`${CONCURRENCY} egyidejű foglalási kísérlet…\n`)

  const results = await Promise.all(
    Array.from({ length: CONCURRENCY }, (_, index) =>
      createBooking({
        eventTypeId: eventType.id,
        startsAt: target.startsAt.toISOString(),
        guestName: `Teszt Vendég ${index + 1}`,
        guestEmail: `vendeg${index + 1}@example.com`,
        guestNote: '',
      }),
    ),
  )

  const succeeded = results.filter((result) => result.ok)
  const rejected = results.filter((result) => !result.ok)

  check('pontosan egy foglalás sikerül', succeeded.length === 1, `${succeeded.length} sikeres`)
  check(
    'a többi kísérlet tiszta hibaüzenetet kap',
    rejected.length === CONCURRENCY - 1 &&
      rejected.every((result) => !result.ok && result.message.length > 0),
  )
  check(
    'az elutasítás oka a foglaltság',
    rejected.every((result) => !result.ok && ['SLOT_TAKEN', 'SLOT_UNKNOWN'].includes(result.code)),
    rejected.length > 0 && !rejected[0].ok ? rejected[0].code : '',
  )

  const stored = await prisma.booking.count({
    where: { eventTypeId: eventType.id, status: 'CONFIRMED' },
  })
  check('az adatbázisban egyetlen érvényes foglalás van', stored === 1, `${stored} rekord`)

  // --- 2. A puffer a szomszédos időpontot is blokkolja ---
  const second = await loadSlots(eventType.id)
  const bookedSlot = second.slots.find(
    (slot) => slot.startsAt.getTime() === target.startsAt.getTime(),
  )
  check(
    'a lefoglalt időpont eltűnik a listából',
    bookedSlot?.available === false,
    bookedSlot?.reason,
  )

  // --- 3. Napi gyakorisági korlát ---
  const limit = eventType.frequencyLimitCount ?? 0
  if (limit > 0 && eventType.frequencyLimitPeriod === 'DAY') {
    const sameDay = availableSlots(second.slots).filter((slot) => slot.dateKey === target.dateKey)

    for (const slot of sameDay.slice(0, limit - 1)) {
      const result = await createBooking({
        eventTypeId: eventType.id,
        startsAt: slot.startsAt.toISOString(),
        guestName: 'Limit Teszt',
        guestEmail: 'limit@example.com',
        guestNote: '',
      })
      check(
        `foglalás a limiten belül (${formatTime(slot.startsAt, eventType.timezone)})`,
        result.ok,
      )
    }

    const third = await loadSlots(eventType.id)
    const stillFree = availableSlots(third.slots).filter((slot) => slot.dateKey === target.dateKey)
    check('a napi limit betelte után nincs több szabad időpont aznap', stillFree.length === 0)

    const blocked = third.slots.find(
      (slot) => slot.dateKey === target.dateKey && slot.reason === 'FREQUENCY_LIMIT',
    )
    check('a lezárás oka a gyakorisági korlát', blocked !== undefined)

    if (blocked) {
      const rejectedByLimit = await createBooking({
        eventTypeId: eventType.id,
        startsAt: blocked.startsAt.toISOString(),
        guestName: 'Limit Teszt',
        guestEmail: 'limit@example.com',
        guestNote: '',
      })
      check(
        'a szerver is elutasítja a limit fölötti foglalást',
        !rejectedByLimit.ok && rejectedByLimit.code === 'FREQUENCY_LIMIT',
      )
    }

    const nextDay = availableSlots(third.slots).filter((slot) => slot.dateKey !== target.dateKey)
    check('a következő napok érintetlenek', nextDay.length > 0, `${nextDay.length} szabad időpont`)
  }

  // --- 4. Lemondás után újra foglalható ---
  const toCancel = await prisma.booking.findFirstOrThrow({
    where: { eventTypeId: eventType.id, status: 'CONFIRMED', activeAt: target.startsAt },
  })
  const cancelled = await cancelBooking(toCancel.id, 'Teszt lemondás')
  check('a foglalás lemondható', cancelled.ok)

  const rebooked = await createBooking({
    eventTypeId: eventType.id,
    startsAt: target.startsAt.toISOString(),
    guestName: 'Új Vendég',
    guestEmail: 'ujvendeg@example.com',
    guestNote: '',
  })
  check('a lemondott időpont újra foglalható', rebooked.ok, rebooked.ok ? '' : rebooked.message)

  const doubleCancel = await cancelBooking(toCancel.id)
  check('a kétszeres lemondás nem okoz hibát', !doubleCancel.ok)

  // Takarítás.
  await prisma.booking.deleteMany({ where: { eventTypeId: eventType.id } })

  console.log(
    `\n${failures === 0 ? 'Minden ellenőrzés rendben.' : `${failures} ellenőrzés bukott.`}`,
  )
  process.exitCode = failures === 0 ? 0 : 1
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
