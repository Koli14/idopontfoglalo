import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/db'
import {
  findSlotAt,
  generateSlots,
  periodBounds,
  type SlotEventType,
  type UnavailableReason,
} from '@/lib/slots'
import { dateKeyToColumn, utcToDateKey } from '@/lib/time'
import type { CreateBookingInput } from '@/lib/validation'

export type BookingErrorCode =
  'NOT_FOUND' | 'INACTIVE' | 'SLOT_UNKNOWN' | 'SLOT_TAKEN' | 'TOO_SOON' | 'FREQUENCY_LIMIT'

export type CreateBookingResult =
  | { ok: true; bookingId: string; manageToken: string }
  | { ok: false; code: BookingErrorCode; message: string }

const REASON_MESSAGES: Record<UnavailableReason, { code: BookingErrorCode; message: string }> = {
  BOOKED: {
    code: 'SLOT_TAKEN',
    message: 'Ezt az időpontot időközben lefoglalták. Válassz másikat.',
  },
  PAST: { code: 'TOO_SOON', message: 'Ez az időpont már elmúlt.' },
  TOO_SOON: {
    code: 'TOO_SOON',
    message: 'Ez az időpont már túl közeli, kérjük válassz egy későbbit.',
  },
  FREQUENCY_LIMIT: {
    code: 'FREQUENCY_LIMIT',
    message: 'Erre az időszakra már betelt a foglalható időpontok száma.',
  },
}

function generateManageToken(): string {
  return randomBytes(24).toString('base64url')
}

function toSlotEventType(eventType: {
  durationMin: number
  bufferBeforeMin: number
  bufferAfterMin: number
  minimumNoticeMin: number
  frequencyLimitCount: number | null
  frequencyLimitPeriod: 'DAY' | 'WEEK' | 'MONTH' | null
  slotIntervalMin: number | null
  timezone: string
}): SlotEventType {
  return eventType
}

/**
 * Foglalás létrehozása. Ez az egyetlen hely, ahol foglalás születik.
 *
 * A versenyhelyzet ellen két, egymástól független védelem van:
 *
 * 1. A tranzakció elején eseménytípusonként veszünk egy tanácsadói zárat
 *    (`pg_advisory_xact_lock`). Így az ellenőrzés és a beszúrás közé nem tud
 *    beékelődni egy másik foglalás — ez fedi le a pufferek miatti ütközést is,
 *    amit egy egyedi index nem tudna kifejezni.
 * 2. A `Booking(eventTypeId, activeAt)` egyedi index adatbázisszinten is
 *    kizárja, hogy ugyanarra a kezdésre két érvényes foglalás kerüljön —
 *    akkor is, ha a zárat valaki megkerülné.
 *
 * Az elérhető időpontokat ugyanaz a `generateSlots()` állítja elő, mint ami a
 * nyilvános oldalon listáz, tehát a kettő nem tud eltérni egymástól.
 */
export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const startsAt = new Date(input.startsAt)

  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false, code: 'SLOT_UNKNOWN', message: 'Érvénytelen időpont.' }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      // Eseménytípusonként sorosítjuk a foglalásokat. A zár a tranzakció
      // végén automatikusan feloldódik.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.eventTypeId}))`

      const eventType = await tx.eventType.findUnique({ where: { id: input.eventTypeId } })

      if (!eventType) {
        return {
          ok: false as const,
          code: 'NOT_FOUND' as const,
          message: 'Az esemény nem található.',
        }
      }

      if (!eventType.isActive) {
        return {
          ok: false as const,
          code: 'INACTIVE' as const,
          message: 'Erre az eseményre jelenleg nem lehet foglalni.',
        }
      }

      const dateKey = utcToDateKey(startsAt, eventType.timezone)

      const windows = await tx.availabilityWindow.findMany({
        where: { eventTypeId: eventType.id, date: dateKeyToColumn(dateKey) },
      })

      if (windows.length === 0) {
        return {
          ok: false as const,
          code: 'SLOT_UNKNOWN' as const,
          message: 'Ez az időpont nem foglalható.',
        }
      }

      // A pufferek miatt a szomszédos napok foglalásai is ütközhetnek, a
      // gyakorisági korláthoz pedig a teljes periódus kell.
      const day = 24 * 60 * 60 * 1000
      let from = new Date(startsAt.getTime() - day)
      let to = new Date(startsAt.getTime() + day)

      if (eventType.frequencyLimitPeriod && eventType.frequencyLimitCount) {
        const bounds = periodBounds(startsAt, eventType.timezone, eventType.frequencyLimitPeriod)
        if (bounds.start < from) from = bounds.start
        if (bounds.end > to) to = bounds.end
      }

      const bookings = await tx.booking.findMany({
        where: {
          eventTypeId: eventType.id,
          status: 'CONFIRMED',
          startsAt: { gte: from, lt: to },
        },
        select: { startsAt: true, endsAt: true },
      })

      const slots = generateSlots({
        eventType: toSlotEventType(eventType),
        windows,
        bookings,
        now: new Date(),
      })

      const slot = findSlotAt(slots, startsAt)

      if (!slot) {
        return {
          ok: false as const,
          code: 'SLOT_UNKNOWN' as const,
          message: 'Ez az időpont már nem foglalható. Frissítsd az oldalt.',
        }
      }

      if (!slot.available) {
        const reason = REASON_MESSAGES[slot.reason ?? 'BOOKED']
        return { ok: false as const, code: reason.code, message: reason.message }
      }

      const manageToken = generateManageToken()

      const created = await tx.booking.create({
        data: {
          eventTypeId: eventType.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          activeAt: slot.startsAt,
          guestName: input.guestName,
          guestEmail: input.guestEmail,
          guestNote: input.guestNote ? input.guestNote : null,
          manageToken,
        },
        select: { id: true, manageToken: true },
      })

      return { ok: true as const, bookingId: created.id, manageToken: created.manageToken }
    })
  } catch (error) {
    // Az egyedi index megsértése azt jelenti, hogy valaki megelőzött minket.
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        code: 'SLOT_TAKEN',
        message: 'Ezt az időpontot időközben lefoglalták. Válassz másikat.',
      }
    }

    throw error
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  )
}

export type CancelBookingResult = { ok: true; bookingId: string } | { ok: false; message: string }

/**
 * Foglalás lemondása. Az `activeAt` nullázásával az idősáv azonnal újra
 * foglalhatóvá válik, a foglalás rekordja viszont megmarad naplónak.
 */
export async function cancelBooking(
  bookingId: string,
  reason?: string | null,
): Promise<CancelBookingResult> {
  const result = await prisma.booking.updateMany({
    where: { id: bookingId, status: 'CONFIRMED' },
    data: {
      status: 'CANCELLED',
      activeAt: null,
      cancelledAt: new Date(),
      cancelReason: reason?.trim() ? reason.trim() : null,
    },
  })

  if (result.count === 0) {
    return { ok: false, message: 'Ez a foglalás már le van mondva.' }
  }

  return { ok: true, bookingId }
}
