'use client'

import { useActionState } from 'react'
import { cancelBookingAction } from '@/app/admin/esemeny/[id]/actions'
import { FormMessage, SubmitButton } from '@/components/form'
import { idleState } from '@/lib/action-result'

export function CancelBookingForm({
  eventTypeId,
  bookingId,
  guestName,
  when,
}: {
  eventTypeId: string
  bookingId: string
  guestName: string
  when: string
}) {
  const [state, action] = useActionState(cancelBookingAction, idleState)

  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <input type="hidden" name="eventTypeId" value={eventTypeId} />
      <input type="hidden" name="bookingId" value={bookingId} />
      <SubmitButton
        variant="secondary"
        pendingLabel="Lemondás…"
        confirm={`Biztosan lemondod ${guestName} foglalását (${when})? A vendég e-mailben értesítést kap.`}
      >
        Lemondás
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  )
}
