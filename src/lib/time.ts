import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz'
import { hu } from 'date-fns/locale'

export const MINUTES_PER_DAY = 1440

/** Alapértelmezett zóna, ha egy eseménytípuson nincs külön beállítva. */
export const DEFAULT_TIMEZONE = 'Europe/Budapest'

/** 'YYYY-MM-DD' alakú naptári nap, idő és zóna nélkül. */
export type DateKey = string

function pad(value: number, length = 2) {
  return String(value).padStart(length, '0')
}

/**
 * A Prisma a `@db.Date` mezőket UTC éjfélre állított Date-ként adja vissza.
 * Ebből olvassuk ki a naptári napot — helyi idő szerinti konverzió nélkül,
 * különben a UTC-től nyugatra eső gépeken egy nappal csúszna.
 */
export function dateColumnToKey(date: Date): DateKey {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
}

/** A naptári napot UTC éjfélre állított Date-té alakítja a `@db.Date` mezőhöz. */
export function dateKeyToColumn(key: DateKey): Date {
  const { year, month, day } = parseDateKey(key)
  return new Date(Date.UTC(year, month - 1, day))
}

export function parseDateKey(key: DateKey) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)

  if (!match) {
    throw new Error(`Érvénytelen dátum: ${key}`)
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
}

/** Napokat ad a naptári naphoz, zónától függetlenül. */
export function addDaysToKey(key: DateKey, days: number): DateKey {
  const { year, month, day } = parseDateKey(key)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return dateColumnToKey(shifted)
}

/**
 * Helyi fali óra → abszolút UTC pillanat.
 *
 * A `minutes` a helyi éjféltől számított percek száma, és lehet 1440 vagy annál
 * több is (pl. a 24:00-ig tartó sáv vége): ilyenkor átfordulunk a következő
 * napra. Ez azért fontos, mert nyári időszámítás váltásakor egy nap 23 vagy 25
 * óra hosszú, tehát nem lehet egyszerűen perceket hozzáadni az éjféli
 * pillanathoz.
 */
export function wallClockToUtc(key: DateKey, minutes: number, timeZone: string): Date {
  const dayOffset = Math.floor(minutes / MINUTES_PER_DAY)
  const withinDay = minutes - dayOffset * MINUTES_PER_DAY
  const targetKey = dayOffset === 0 ? key : addDaysToKey(key, dayOffset)
  const hours = Math.floor(withinDay / 60)
  const mins = withinDay % 60

  return fromZonedTime(`${targetKey}T${pad(hours)}:${pad(mins)}:00`, timeZone)
}

/** Abszolút pillanat → az adott zónában érvényes naptári nap. */
export function utcToDateKey(instant: Date, timeZone: string): DateKey {
  return formatInTimeZone(instant, timeZone, 'yyyy-MM-dd')
}

/** Abszolút pillanat → helyi éjféltől számított percek. */
export function utcToMinutesOfDay(instant: Date, timeZone: string): number {
  const zoned = toZonedTime(instant, timeZone)
  return zoned.getHours() * 60 + zoned.getMinutes()
}

// ---------------------------------------------------------------------------
// Formázás (magyar)
// ---------------------------------------------------------------------------

/** '09:30' */
export function formatTime(instant: Date, timeZone: string): string {
  return formatInTimeZone(instant, timeZone, 'HH:mm')
}

/** '2026. szeptember 3.' */
export function formatLongDate(instant: Date, timeZone: string): string {
  return formatInTimeZone(instant, timeZone, 'yyyy. MMMM d.', { locale: hu })
}

/** '2026. szeptember 3., csütörtök' */
export function formatLongDateWithWeekday(instant: Date, timeZone: string): string {
  return formatInTimeZone(instant, timeZone, 'yyyy. MMMM d., EEEE', { locale: hu })
}

/** '2026. szeptember 3., csütörtök 09:30–10:15' */
export function formatDateTimeRange(start: Date, end: Date, timeZone: string): string {
  return `${formatLongDateWithWeekday(start, timeZone)} ${formatTime(start, timeZone)}–${formatTime(end, timeZone)}`
}

/** '90 perc' / '1 óra 30 perc' */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} perc`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  if (rest === 0) return `${hours} óra`
  return `${hours} óra ${rest} perc`
}

/** Percek → 'HH:mm' a sávszerkesztőhöz. */
export function minutesToLabel(minutes: number): string {
  const normalized = Math.max(0, Math.min(MINUTES_PER_DAY, Math.round(minutes)))
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`
}

/** 'HH:mm' → percek. Érvénytelen bemenetre null. */
export function labelToMinutes(label: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(label.trim())
  if (!match) return null

  const hours = Number(match[1])
  const mins = Number(match[2])

  if (hours > 24 || mins > 59) return null
  const total = hours * 60 + mins

  return total <= MINUTES_PER_DAY ? total : null
}
