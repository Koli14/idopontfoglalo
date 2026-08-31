'use client'

import { useActionState } from 'react'
import { deleteEventTypeAction } from '@/app/admin/actions'
import { FormMessage, SubmitButton } from '@/components/form'
import { idleState } from '@/lib/action-result'

export function DeleteEventSection({ eventTypeId, title }: { eventTypeId: string; title: string }) {
  const [state, action] = useActionState(deleteEventTypeAction, idleState)

  return (
    <section className="card border-danger/25 p-6">
      <h2 className="text-xs font-semibold tracking-wider text-danger uppercase">
        Esemény törlése
      </h2>
      <p className="mt-2 text-sm text-muted">
        A törléssel az esemény összes elérhetőségi sávja és foglalása véglegesen elvész. A vendégek
        nem kapnak automatikus értesítést — ha vannak élő foglalások, előbb mondd le őket.
      </p>

      <form action={action} className="mt-4 flex flex-wrap items-center gap-3">
        <input type="hidden" name="eventTypeId" value={eventTypeId} />
        <SubmitButton
          variant="danger"
          pendingLabel="Törlés…"
          confirm={`Biztosan törlöd a(z) "${title}" eseményt az összes foglalásával együtt? Ez nem vonható vissza.`}
        >
          Esemény végleges törlése
        </SubmitButton>
        <FormMessage state={state} />
      </form>
    </section>
  )
}
