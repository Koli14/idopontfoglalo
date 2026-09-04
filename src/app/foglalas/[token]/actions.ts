'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { cancelBooking } from '@/lib/booking'
import { notifyBookingCancelled } from '@/lib/notifications'
import { errorState, successState, text, type ActionState } from '@/lib/action-result'

/**
 * A vendég lemondása. A jogosultságot a kezelőtoken adja: aki ismeri, az
 * kapta a visszaigazoló levelet.
 */
export async function guestCancelAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const token = text(form, 'token')

  const booking = await prisma.booking.findUnique({
    where: { manageToken: token },
    select: { id: true, startsAt: true, status: true, eventType: { select: { slug: true } } },
  })

  if (!booking) return errorState('Ez a foglalás nem található.')

  if (booking.status === 'CANCELLED') {
    return errorState('Ez a foglalás már le van mondva.')
  }

  if (booking.startsAt <= new Date()) {
    return errorState('Ez az időpont már elmúlt, nem lehet lemondani.')
  }

  const result = await cancelBooking(booking.id, text(form, 'reason'))

  if (!result.ok) return errorState(result.message)

  await notifyBookingCancelled(booking.id, 'GUEST')

  revalidatePath(`/foglalas/${token}`)
  revalidatePath(`/${booking.eventType.slug}`)

  return successState('Az időpontot lemondtuk. A szervezőt értesítettük.')
}
