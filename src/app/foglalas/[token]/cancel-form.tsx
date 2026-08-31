'use client'

import { useActionState } from 'react'
import { guestCancelAction } from '@/app/foglalas/[token]/actions'
import { FormMessage, SubmitButton } from '@/components/form'
import { idleState } from '@/lib/action-result'

export function GuestCancelForm({ token }: { token: string }) {
  const [state, action] = useActionState(guestCancelAction, idleState)

  if (state.status === 'success') {
    return <FormMessage state={state} />
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />

      <div>
        <label className="label" htmlFor="reason">
          Lemondás oka <span className="font-normal text-muted">(nem kötelező)</span>
        </label>
        <textarea
          id="reason"
          name="reason"
          className="field"
          rows={2}
          maxLength={500}
          placeholder="Segít a szervezőnek, ha tudja, miért nem tudsz jönni."
        />
      </div>

      <FormMessage state={state} />

      <SubmitButton
        variant="danger"
        pendingLabel="Lemondás…"
        confirm="Biztosan lemondod ezt az időpontot?"
      >
        Időpont lemondása
      </SubmitButton>
    </form>
  )
}
