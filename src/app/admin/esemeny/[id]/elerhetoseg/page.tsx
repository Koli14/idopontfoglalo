import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { requireEventAccess } from '@/lib/auth-guards'
import {
  dayNumber,
  isMonthKey,
  monthGrid,
  monthKeyOf,
  monthLabel,
  shiftMonth,
  WEEKDAY_LABELS,
  type MonthKey,
} from '@/lib/calendar'
import { generateSlots, groupSlotsByDate } from '@/lib/slots'
import {
  addDaysToKey,
  dateColumnToKey,
  dateKeyToColumn,
  formatLongDateWithWeekday,
  formatTime,
  minutesToLabel,
  utcToDateKey,
  wallClockToUtc,
} from '@/lib/time'
import { DayPanel, type CopyTarget } from '@/app/admin/esemeny/[id]/elerhetoseg/day-panel'

export const metadata: Metadata = { title: 'Elérhetőség' }

export default async function AvailabilityPage({
  params,
  searchParams,
}: PageProps<'/admin/esemeny/[id]/elerhetoseg'>) {
  const { id } = await params
  await requireEventAccess(id)

  const eventType = await prisma.eventType.findUnique({ where: { id } })
  if (!eventType) notFound()

  const query = await searchParams
  const today = utcToDateKey(new Date(), eventType.timezone)

  const requestedMonth = typeof query.ho === 'string' ? query.ho : ''
  const month: MonthKey = isMonthKey(requestedMonth) ? requestedMonth : monthKeyOf(today)

  const requestedDay = typeof query.nap === 'string' ? query.nap : ''
  const weeks = monthGrid(month)
  const monthDays = weeks.flat().filter((day) => day.inMonth)

  // A rács szélein a szomszédos hónapok napjai is látszanak, ezért a teljes
  // rácsra kérünk le sávokat — és a kiválasztás is bármelyik látható napra eshet.
  const gridStart = weeks[0][0].key
  const gridEnd = addDaysToKey(weeks[weeks.length - 1][6].key, 1)

  const selectedDay =
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDay) && requestedDay >= gridStart && requestedDay < gridEnd
      ? requestedDay
      : (monthDays.find((day) => day.key >= today)?.key ?? monthDays[0].key)

  const windows = await prisma.availabilityWindow.findMany({
    where: {
      eventTypeId: id,
      date: { gte: dateKeyToColumn(gridStart), lt: dateKeyToColumn(gridEnd) },
    },
    orderBy: [{ date: 'asc' }, { startMin: 'asc' }],
  })

  const bookings = await prisma.booking.findMany({
    where: {
      eventTypeId: id,
      status: 'CONFIRMED',
      startsAt: {
        gte: wallClockToUtc(gridStart, 0, eventType.timezone),
        lt: wallClockToUtc(gridEnd, 0, eventType.timezone),
      },
    },
    select: { startsAt: true, endsAt: true },
  })

  const slotsByDate = groupSlotsByDate(
    generateSlots({ eventType, windows, bookings, now: new Date() }),
  )

  const windowsByDate = new Map<string, typeof windows>()
  for (const window of windows) {
    const key = dateColumnToKey(window.date)
    const bucket = windowsByDate.get(key)
    if (bucket) bucket.push(window)
    else windowsByDate.set(key, [window])
  }

  const selectedWindows = windowsByDate.get(selectedDay) ?? []
  const selectedSlots = slotsByDate.get(selectedDay) ?? []

  const copyTargets: CopyTarget[] = monthDays
    .filter((day) => day.key !== selectedDay)
    .map((day) => ({
      dateKey: day.key,
      label: String(dayNumber(day.key)),
      hasWindows: (windowsByDate.get(day.key)?.length ?? 0) > 0,
    }))

  const monthHref = (target: MonthKey) => `/admin/esemeny/${id}/elerhetoseg?ho=${target}`
  const dayHref = (day: string) =>
    `/admin/esemeny/${id}/elerhetoseg?ho=${monthKeyOf(day)}&nap=${day}`

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section className="card p-5">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-base font-semibold">{monthLabel(month)}</h2>

          <div className="flex items-center gap-1">
            <Link
              href={monthHref(shiftMonth(month, -1))}
              className="btn-secondary !px-3"
              aria-label="Előző hónap"
            >
              ←
            </Link>
            <Link href={monthHref(monthKeyOf(today))} className="btn-secondary">
              Ma
            </Link>
            <Link
              href={monthHref(shiftMonth(month, 1))}
              className="btn-secondary !px-3"
              aria-label="Következő hónap"
            >
              →
            </Link>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-1">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="pb-1 text-center text-xs font-medium text-muted">
              {label}
            </div>
          ))}

          {weeks.flat().map((day) => {
            const dayWindows = windowsByDate.get(day.key) ?? []
            const free = (slotsByDate.get(day.key) ?? []).filter((slot) => slot.available).length
            const isSelected = day.key === selectedDay
            const isToday = day.key === today

            return (
              <Link
                key={day.key}
                href={dayHref(day.key)}
                aria-current={isSelected ? 'date' : undefined}
                className={`flex min-h-20 flex-col rounded-lg border p-1.5 text-left transition ${
                  isSelected
                    ? 'border-accent bg-accent-soft'
                    : 'border-line hover:border-line-strong hover:bg-canvas'
                } ${day.inMonth ? '' : 'opacity-40'}`}
              >
                <span
                  className={`text-xs font-medium ${
                    isToday ? 'text-accent' : day.inMonth ? 'text-ink' : 'text-subtle'
                  }`}
                >
                  {dayNumber(day.key)}
                  {isToday ? ' •' : ''}
                </span>

                <span className="mt-1 space-y-0.5">
                  {dayWindows.slice(0, 2).map((window) => (
                    <span
                      key={window.id}
                      className="block truncate rounded bg-accent/10 px-1 font-mono text-[10px] leading-4 text-accent"
                    >
                      {minutesToLabel(window.startMin)}–{minutesToLabel(window.endMin)}
                    </span>
                  ))}
                  {dayWindows.length > 2 ? (
                    <span className="block text-[10px] text-muted">
                      +{dayWindows.length - 2} sáv
                    </span>
                  ) : null}
                </span>

                {free > 0 ? (
                  <span className="mt-auto pt-1 text-[10px] text-muted">{free} szabad</span>
                ) : null}
              </Link>
            )
          })}
        </div>

        <p className="hint mt-4">
          Az időpontok {eventType.timezone.replace('_', ' ')} idő szerint értendők. Kattints egy
          napra a sávok szerkesztéséhez.
        </p>
      </section>

      <aside className="card h-fit p-5">
        <DayPanel
          eventTypeId={id}
          dateKey={selectedDay}
          dateLabel={formatLongDateWithWeekday(
            wallClockToUtc(selectedDay, 12 * 60, eventType.timezone),
            eventType.timezone,
          )}
          windows={selectedWindows.map((window) => ({
            id: window.id,
            startMin: window.startMin,
            endMin: window.endMin,
          }))}
          slots={selectedSlots.map((slot) => ({
            label: formatTime(slot.startsAt, eventType.timezone),
            available: slot.available,
            reason: slot.reason,
          }))}
          copyTargets={copyTargets}
        />
      </aside>
    </div>
  )
}
