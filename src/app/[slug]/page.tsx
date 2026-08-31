import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { availableSlots, generateSlots, groupSlotsByDate } from '@/lib/slots'
import {
  addDaysToKey,
  dateKeyToColumn,
  formatDuration,
  formatLongDateWithWeekday,
  formatTime,
  utcToDateKey,
  wallClockToUtc,
} from '@/lib/time'
import { BookingFlow, type PublicDay } from '@/app/[slug]/booking-flow'

/** Ennyi napra előre mutatunk időpontokat a foglalóoldalon. */
const HORIZON_DAYS = 60

const WEEKDAY_SHORT = ['vas', 'hét', 'kedd', 'sze', 'csüt', 'pén', 'szo']

function loadEventType(slug: string) {
  return prisma.eventType.findUnique({
    where: { slug },
    include: { owner: { select: { name: true, image: true } } },
  })
}

export async function generateMetadata({ params }: PageProps<'/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const eventType = await loadEventType(slug)

  if (!eventType) return { title: 'Az esemény nem található' }

  return {
    title: eventType.title,
    description:
      eventType.description ??
      `Foglalj ${formatDuration(eventType.durationMin)} időpontot: ${eventType.title}.`,
  }
}

export default async function PublicBookingPage({ params }: PageProps<'/[slug]'>) {
  const { slug } = await params
  const eventType = await loadEventType(slug)

  if (!eventType) notFound()

  const now = new Date()
  const timezone = eventType.timezone
  const todayKey = utcToDateKey(now, timezone)
  const horizonKey = addDaysToKey(todayKey, HORIZON_DAYS)

  const [windows, bookings] = await Promise.all([
    prisma.availabilityWindow.findMany({
      where: {
        eventTypeId: eventType.id,
        date: { gte: dateKeyToColumn(todayKey), lt: dateKeyToColumn(horizonKey) },
      },
    }),
    prisma.booking.findMany({
      where: {
        eventTypeId: eventType.id,
        status: 'CONFIRMED',
        startsAt: {
          gte: wallClockToUtc(addDaysToKey(todayKey, -1), 0, timezone),
          lt: wallClockToUtc(addDaysToKey(horizonKey, 1), 0, timezone),
        },
      },
      select: { startsAt: true, endsAt: true },
    }),
  ])

  const slots = eventType.isActive
    ? availableSlots(generateSlots({ eventType, windows, bookings, now }))
    : []

  const days: PublicDay[] = [...groupSlotsByDate(slots).entries()].map(([dateKey, daySlots]) => {
    const reference = daySlots[0].startsAt
    const weekdayIndex = new Date(`${dateKey}T12:00:00Z`).getUTCDay()

    return {
      dateKey,
      dayNumber: dateKey.slice(8, 10).replace(/^0/, ''),
      weekday: WEEKDAY_SHORT[weekdayIndex],
      longLabel: formatLongDateWithWeekday(reference, timezone),
      monthLabel: dateKey.slice(0, 7),
      slots: daySlots.map((slot) => ({
        value: slot.startsAt.toISOString(),
        time: formatTime(slot.startsAt, timezone),
        range: `${formatTime(slot.startsAt, timezone)} – ${formatTime(slot.endsAt, timezone)}`,
      })),
    }
  })

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <div className="card grid gap-8 p-8 md:grid-cols-[18rem_1fr]">
        <aside className="space-y-4 md:border-r md:border-line md:pr-8">
          <div>
            <p className="text-sm text-muted">{eventType.owner.name ?? 'Szervező'}</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-balance">
              {eventType.title}
            </h1>
          </div>

          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-muted">Hossz:</dt>
              <dd className="font-medium">{formatDuration(eventType.durationMin)}</dd>
            </div>

            {eventType.locationNote ? (
              <div className="flex gap-2">
                <dt className="text-muted">Helyszín:</dt>
                <dd className="font-medium">{eventType.locationNote}</dd>
              </div>
            ) : null}

            <div className="flex gap-2">
              <dt className="text-muted">Időzóna:</dt>
              <dd className="font-medium">{timezone}</dd>
            </div>
          </dl>

          {eventType.description ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted">
              {eventType.description}
            </p>
          ) : null}
        </aside>

        <div>
          {eventType.isActive ? (
            <BookingFlow eventTypeId={eventType.id} slug={eventType.slug} days={days} />
          ) : (
            <p className="alert-info">
              Erre az eseményre jelenleg nem lehet időpontot foglalni. Kérjük, nézz vissza később.
            </p>
          )}
        </div>
      </div>

      <p className="mt-6 text-center text-xs text-subtle">
        Az időpontok {timezone} idő szerint értendők.
      </p>
    </main>
  )
}
