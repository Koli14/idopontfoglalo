import { ZodError, type ZodType } from 'zod'

/** Minden szerveroldali művelet ezt adja vissza az űrlapoknak. */
export type ActionState = {
  status: 'idle' | 'success' | 'error'
  message?: string
  /** Mezőnkénti hibák, hogy az űrlap a beviteli mező mellé tudja írni őket. */
  fieldErrors?: Record<string, string>
}

export const idleState: ActionState = { status: 'idle' }

export function errorState(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { status: 'error', message, fieldErrors }
}

export function successState(message?: string): ActionState {
  return { status: 'success', message }
}

/** A Zod hibáit mezőnként egy-egy üzenetté lapítja. */
export function fieldErrorsFrom(error: ZodError): Record<string, string> {
  const result: Record<string, string> = {}

  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form'
    if (!result[key]) result[key] = issue.message
  }

  return result
}

/**
 * FormData validálása. Hiba esetén kész `ActionState`-et ad vissza, így a
 * műveletek nem ismétlik ugyanazt a hibakezelést.
 */
export function parseForm<T>(
  schema: ZodType<T>,
  values: Record<string, unknown>,
): { ok: true; data: T } | { ok: false; state: ActionState } {
  const parsed = schema.safeParse(values)

  if (parsed.success) return { ok: true, data: parsed.data }

  const fieldErrors = fieldErrorsFrom(parsed.error)
  const firstMessage = Object.values(fieldErrors)[0] ?? 'Érvénytelen adatok.'

  return { ok: false, state: errorState(firstMessage, fieldErrors) }
}

/** Az űrlapmezők kiolvasása: az üres string a hiányzó értéket jelenti. */
export function text(form: FormData, key: string): string {
  const value = form.get(key)
  return typeof value === 'string' ? value : ''
}

export function checkbox(form: FormData, key: string): boolean {
  return form.get(key) === 'on' || form.get(key) === 'true'
}

/**
 * Kapcsolóhoz kötött szám: ha a kapcsoló ki van kapcsolva, `null` az érték.
 * A gyakorisági korlát és az emlékeztető is így működik.
 */
export function optionalNumber(form: FormData, key: string, enabled: boolean): number | null {
  if (!enabled) return null

  const raw = text(form, key).trim()
  if (raw === '') return null

  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}
