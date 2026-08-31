'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createBooking } from '@/lib/booking'
import { notifyBookingCreated } from '@/lib/notifications'
import { createBookingSchema } from '@/lib/validation'
import { errorState, parseForm, text, type ActionState } from '@/lib/action-result'

/**
 * Nyilvános foglalás. Hitelesítés nincs — a védelmet az adja, hogy a
 * `createBooking()` a szerveren újragenerálja az elérhető időpontokat, és csak
 * valóban szabad sávra enged foglalni.
 */
export async function createBookingAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = parseForm(createBookingSchema, {
    eventTypeId: text(form, 'eventTypeId'),
    startsAt: text(form, 'startsAt'),
    guestName: text(form, 'guestName'),
    guestEmail: text(form, 'guestEmail'),
    guestNote: text(form, 'guestNote'),
  })

  if (!parsed.ok) return parsed.state

  const result = await createBooking(parsed.data)

  if (!result.ok) {
    return errorState(result.message)
  }

  // A visszaigazoló levelek nem tartják vissza az átirányítást.
  await notifyBookingCreated(result.bookingId)

  revalidatePath(`/${text(form, 'slug')}`)
  redirect(`/foglalas/${result.manageToken}`)
}
