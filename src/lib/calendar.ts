import { addDaysToKey, dateColumnToKey, type DateKey } from '@/lib/time'

/** 'YYYY-MM' alakú hónapkulcs. */
export type MonthKey = string

export const WEEKDAY_LABELS = ['H', 'K', 'Sze', 'Cs', 'P', 'Szo', 'V']

const MONTH_NAMES = [
  'január',
  'február',
  'március',
  'április',
  'május',
  'június',
  'július',
  'augusztus',
  'szeptember',
  'október',
  'november',
  'december',
]

export function isMonthKey(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export function monthKeyOf(dateKey: DateKey): MonthKey {
  return dateKey.slice(0, 7)
}

export function monthLabel(month: MonthKey): string {
  const [year, index] = month.split('-').map(Number)
  return `${year}. ${MONTH_NAMES[index - 1]}`
}

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [year, index] = month.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, index - 1 + delta, 1))
  return dateColumnToKey(shifted).slice(0, 7)
}

export type CalendarDay = {
  key: DateKey
  inMonth: boolean
}

/**
 * A hónap naptárrácsa, hétfővel kezdődő teljes hetekre kiegészítve.
 * A szomszédos hónapok napjai is megjelennek, `inMonth: false` jelöléssel.
 */
export function monthGrid(month: MonthKey): CalendarDay[][] {
  const [year, index] = month.split('-').map(Number)
  const first = new Date(Date.UTC(year, index - 1, 1))
  // getUTCDay: 0 = vasárnap; hétfő-kezdésre alakítjuk.
  const leading = (first.getUTCDay() + 6) % 7
  const start = addDaysToKey(dateColumnToKey(first), -leading)

  const daysInMonth = new Date(Date.UTC(year, index, 0)).getUTCDate()
  const totalCells = Math.ceil((leading + daysInMonth) / 7) * 7

  const weeks: CalendarDay[][] = []

  for (let cell = 0; cell < totalCells; cell += 1) {
    const key = addDaysToKey(start, cell)

    if (cell % 7 === 0) weeks.push([])
    weeks[weeks.length - 1].push({ key, inMonth: monthKeyOf(key) === month })
  }

  return weeks
}

/** '3.' — a nap sorszáma a naptárcellában. */
export function dayNumber(dateKey: DateKey): number {
  return Number(dateKey.slice(8, 10))
}
