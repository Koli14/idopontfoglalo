import 'dotenv/config'
import { prisma } from '../src/lib/db'
import { addDaysToKey, dateKeyToColumn, utcToDateKey } from '../src/lib/time'

const TZ = 'Europe/Budapest'

async function main() {
  const owner = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: {},
    create: {
      email: 'demo@example.com',
      name: 'Demo Szervező',
      emailVerified: new Date(),
    },
  })

  const eventType = await prisma.eventType.upsert({
    where: { slug: 'konzultacio' },
    update: {},
    create: {
      slug: 'konzultacio',
      title: 'Konzultáció',
      description: 'Kötetlen beszélgetés a projektről. Kérlek, írd meg röviden, mi a téma.',
      locationNote: 'Google Meet — a linket a visszaigazoló e-mailben küldjük.',
      ownerId: owner.id,
      durationMin: 45,
      bufferAfterMin: 15,
      minimumNoticeMin: 6 * 60,
      frequencyLimitCount: 3,
      frequencyLimitPeriod: 'DAY',
      reminderHoursBefore: 24,
    },
  })

  // Két hétre előre, hétköznap délelőtt és délután.
  const today = utcToDateKey(new Date(), TZ)
  await prisma.availabilityWindow.deleteMany({ where: { eventTypeId: eventType.id } })

  const windows: { eventTypeId: string; date: Date; startMin: number; endMin: number }[] = []

  for (let offset = 1; offset <= 14; offset += 1) {
    const key = addDaysToKey(today, offset)
    const weekday = new Date(`${key}T12:00:00Z`).getUTCDay()

    if (weekday === 0 || weekday === 6) continue

    windows.push(
      { eventTypeId: eventType.id, date: dateKeyToColumn(key), startMin: 9 * 60, endMin: 12 * 60 },
      { eventTypeId: eventType.id, date: dateKeyToColumn(key), startMin: 14 * 60, endMin: 17 * 60 },
    )
  }

  await prisma.availabilityWindow.createMany({ data: windows })

  console.log(`Kész: ${eventType.title} (/${eventType.slug}) — ${windows.length} elérhetőségi sáv.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
