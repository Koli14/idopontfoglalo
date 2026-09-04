'use client'

import { useFormStatus } from 'react-dom'
import type { ActionState } from '@/lib/action-result'

type SubmitButtonProps = {
  children: React.ReactNode
  pendingLabel?: string
  className?: string
  variant?: 'primary' | 'secondary' | 'danger'
  confirm?: string
}

/**
 * Küldés gomb, ami a művelet futása alatt letiltja magát. A `confirm`
 * megerősítő kérdést tesz fel a visszafordíthatatlan műveletek előtt.
 */
export function SubmitButton({
  children,
  pendingLabel,
  className,
  variant = 'primary',
  confirm,
}: SubmitButtonProps) {
  const { pending } = useFormStatus()
  const variantClass =
    variant === 'primary' ? 'btn-primary' : variant === 'danger' ? 'btn-danger' : 'btn-secondary'

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${variantClass} ${className ?? ''}`}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault()
      }}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  )
}

/** A művelet eredményének visszajelzése az űrlap tetején. */
export function FormMessage({ state }: { state: ActionState }) {
  if (state.status === 'idle' || !state.message) return null

  return (
    <p role="status" className={state.status === 'error' ? 'alert-error' : 'alert-success'}>
      {state.message}
    </p>
  )
}

/** Egy mező alá tartozó hibaüzenet. */
export function FieldError({ state, name }: { state: ActionState; name: string }) {
  const message = state.fieldErrors?.[name]
  if (!message) return null

  return <p className="mt-1 text-xs font-medium text-danger">{message}</p>
}
