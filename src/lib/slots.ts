import { formatInTimeZone } from 'date-fns-tz'
import {
  addDaysToKey,
  dateColumnToKey,
  utcToDateKey,
  wallClockToUtc,
  type DateKey,
} from '@/lib/time'

export type LimitPeriodValue = 'DAY' | 'WEEK' | 'MONTH'

/** Az időpontgeneráláshoz szükséges eseménytípus-beállítások. */
export type SlotEventType = {
  durationMin: number
  bufferBeforeMin: number
  bufferAfterMin: number
  minimumNoticeMin: number
  frequencyLimitCount: number | null
  frequencyLimitPeriod: LimitPeriodValue | null
  slotIntervalMin: number | null
  timezone: string
}

/** Elérhetőségi sáv. A `date` lehet a Prisma `@db.Date` értéke vagy 'YYYY-MM-DD'. */
export type SlotWindow = {
  date: Date | DateKey
  startMin: number
  endMin: number
}

/** Egy érvényes (nem lemondott) foglalás. */
export type SlotBooking = {
  startsAt: Date
  endsAt: Date
}

export type UnavailableReason =
  /** Ütközik egy meglévő foglalással (a pufferekkel együtt). */
  | 'BOOKED'
  /** Már elmúlt. */
  | 'PAST'
  /** A minimális előfoglalási időn belül van. */
  | 'TOO_SOON'
  /** Az adott napra/hétre/hónapra megengedett foglalásszám betelt. */
  | 'FREQUENCY_LIMIT'

export type Slot = {
  startsAt: Date
  endsAt: Date
  /** Az esemény zónája szerinti naptári nap. */
  dateKey: DateKey
  available: boolean
  reason?: UnavailableReason
}

export type GenerateSlotsInput = {
  eventType: SlotEventType
  windows: SlotWindow[]
  bookings: SlotBooking[]
  now: Date
  /** Opcionális szűrés: csak az ebbe az intervallumba eső időpontok. */
  rangeStart?: Date
  rangeEnd?: Date
}

/**
 * A sávok lépésköze. Ha nincs kézzel megadva, a megbeszélés hossza plusz a
 * pufferek — így az egymás után generált időpontok nem zárják ki egymást.
 */
export function slotStepMinutes(eventType: SlotEventType): number {
  const step =
    eventType.slotIntervalMin ??
    eventType.durationMin + eventType.bufferBeforeMin + eventType.bufferAfterMin

  return Math.max(1, step)
}

/**
 * Egy megbeszélés által ténylegesen lefoglalt idősáv: a találkozó hossza,
 * kiegészítve az előtte és utána tartandó pufferrel. Két megbeszélés akkor
 * ütközik, ha ezek a sávok átfedik egymást.
 */
function blockedSpan(start: Date, end: Date, eventType: SlotEventType) {
  return {
    from: start.getTime() - eventType.bufferBeforeMin * 60_000,
    to: end.getTime() + eventType.bufferAfterMin * 60_000,
  }
}

/** A gyakorisági korlát számlálásához használt periódus kulcsa. */
export function periodKey(instant: Date, timeZone: string, period: LimitPeriodValue): string {
  switch (period) {
    case 'DAY':
      return utcToDateKey(instant, timeZone)
    case 'MONTH':
      return formatInTimeZone(instant, timeZone, 'yyyy-MM')
    case 'WEEK': {
      // Hétfővel kezdődő hét: az ISO napszámból (1 = hétfő) visszalépünk.
      const isoWeekday = Number(formatInTimeZone(instant, timeZone, 'i'))
      return addDaysToKey(utcToDateKey(instant, timeZone), 1 - isoWeekday)
    }
  }
}

function windowDateKey(window: SlotWindow): DateKey {
  return typeof window.date === 'string' ? window.date : dateColumnToKey(window.date)
}

/**
 * Legenerálja az eseménytípus foglalható időpontjait a megadott sávokból.
 *
 * A visszaadott lista a nem foglalható időpontokat is tartalmazza (`available:
 * false` és egy `reason`), hogy a szerkesztői előnézet és a foglalás
 * ellenőrzése is pontos visszajelzést tudjon adni. A nyilvános foglalóoldal az
 * `availableSlots()` segédfüggvényt használja.
 *
 * Ez az egyetlen hely, ahol az időpontok előállnak: a foglalás mentése is
 * ezzel ellenőriz, így a listázás és a mentés nem tud eltérni egymástól.
 */
export function generateSlots(input: GenerateSlotsInput): Slot[] {
  const { eventType, windows, bookings, now, rangeStart, rangeEnd } = input
  const { timezone, durationMin } = eventType

  if (durationMin <= 0) return []

  const step = slotStepMinutes(eventType)
  const durationMs = durationMin * 60_000
  const noticeCutoff = now.getTime() + eventType.minimumNoticeMin * 60_000

  const bookedSpans = bookings.map((booking) =>
    blockedSpan(booking.startsAt, booking.endsAt, eventType),
  )

  // Periódusonként előre megszámoljuk a meglévő foglalásokat, hogy a
  // gyakorisági korlát ellenőrzése O(1) legyen időpontonként.
  const limitPeriod = eventType.frequencyLimitPeriod
  const limitCount = eventType.frequencyLimitCount
  const limitActive = limitPeriod !== null && limitCount !== null && limitCount > 0
  const perPeriodCounts = new Map<string, number>()

  if (limitActive) {
    for (const booking of bookings) {
      const key = periodKey(booking.startsAt, timezone, limitPeriod)
      perPeriodCounts.set(key, (perPeriodCounts.get(key) ?? 0) + 1)
    }
  }

  const byStart = new Map<number, Slot>()

  for (const window of windows) {
    if (window.endMin <= window.startMin) continue

    const dateKey = windowDateKey(window)
    const windowEnd = wallClockToUtc(dateKey, window.endMin, timezone).getTime()

    for (let minute = window.startMin; minute < window.endMin; minute += step) {
      const startsAt = wallClockToUtc(dateKey, minute, timezone)
      const startMs = startsAt.getTime()
      const endMs = startMs + durationMs

      // A találkozónak el kell férnie a sávban. Nyári időszámítás váltásakor a
      // sáv rövidebb vagy hosszabb lehet, mint a percekből adódó hossz — ezért
      // abszolút pillanatokkal hasonlítunk, nem percekkel.
      if (endMs > windowEnd) break

      if (rangeStart && startMs < rangeStart.getTime()) continue
      if (rangeEnd && startMs >= rangeEnd.getTime()) continue

      const endsAt = new Date(endMs)
      const slotDateKey = utcToDateKey(startsAt, timezone)

      const slot: Slot = {
        startsAt,
        endsAt,
        dateKey: slotDateKey,
        available: true,
      }

      const span = blockedSpan(startsAt, endsAt, eventType)
      const collides = bookedSpans.some((booked) => span.from < booked.to && booked.from < span.to)

      if (startMs <= now.getTime()) {
        slot.available = false
        slot.reason = 'PAST'
      } else if (collides) {
        slot.available = false
        slot.reason = 'BOOKED'
      } else if (startMs < noticeCutoff) {
        slot.available = false
        slot.reason = 'TOO_SOON'
      } else if (limitActive) {
        const used = perPeriodCounts.get(periodKey(startsAt, timezone, limitPeriod)) ?? 0

        if (used >= limitCount) {
          slot.available = false
          slot.reason = 'FREQUENCY_LIMIT'
        }
      }

      // Átfedő sávok ugyanazt az időpontot is előállíthatják; ilyenkor a
      // foglalható változatot tartjuk meg.
      const existing = byStart.get(startMs)
      if (!existing || (!existing.available && slot.available)) {
        byStart.set(startMs, slot)
      }
    }
  }

  return [...byStart.values()].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}

export function availableSlots(slots: Slot[]): Slot[] {
  return slots.filter((slot) => slot.available)
}

/** Naptári nap szerint csoportosítja az időpontokat, sorrendtartóan. */
export function groupSlotsByDate(slots: Slot[]): Map<DateKey, Slot[]> {
  const grouped = new Map<DateKey, Slot[]>()

  for (const slot of slots) {
    const bucket = grouped.get(slot.dateKey)
    if (bucket) bucket.push(slot)
    else grouped.set(slot.dateKey, [slot])
  }

  return grouped
}

/**
 * Megkeresi a pontosan az adott pillanatban kezdődő időpontot. A foglalás
 * mentése ezzel ellenőrzi, hogy a kért időpont valóban létezik és szabad.
 */
export function findSlotAt(slots: Slot[], startsAt: Date): Slot | undefined {
  return slots.find((slot) => slot.startsAt.getTime() === startsAt.getTime())
}

/**
 * A gyakorisági korlát periódusának határai abszolút pillanatokban.
 * A foglalás mentése ezzel tudja, mekkora időszakra kell összeszámolni a
 * meglévő foglalásokat.
 */
export function periodBounds(
  instant: Date,
  timeZone: string,
  period: LimitPeriodValue,
): { start: Date; end: Date } {
  switch (period) {
    case 'DAY': {
      const key = utcToDateKey(instant, timeZone)
      return {
        start: wallClockToUtc(key, 0, timeZone),
        end: wallClockToUtc(addDaysToKey(key, 1), 0, timeZone),
      }
    }
    case 'WEEK': {
      const monday = periodKey(instant, timeZone, 'WEEK')
      return {
        start: wallClockToUtc(monday, 0, timeZone),
        end: wallClockToUtc(addDaysToKey(monday, 7), 0, timeZone),
      }
    }
    case 'MONTH': {
      const [year, month] = periodKey(instant, timeZone, 'MONTH').split('-').map(Number)
      const first = `${year}-${String(month).padStart(2, '0')}-01`
      const nextYear = month === 12 ? year + 1 : year
      const nextMonth = month === 12 ? 1 : month + 1
      const next = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`

      return {
        start: wallClockToUtc(first, 0, timeZone),
        end: wallClockToUtc(next, 0, timeZone),
      }
    }
  }
}
