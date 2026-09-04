'use client'

import { useActionState, useState } from 'react'
import { createEventTypeAction } from '@/app/admin/actions'
import { FieldError, FormMessage, SubmitButton } from '@/components/form'
import { idleState } from '@/lib/action-result'
import { slugify } from '@/lib/validation'

const DURATIONS = [15, 30, 45, 60, 90]

export function NewEventForm({ appUrl }: { appUrl: string }) {
  const [state, action] = useActionState(createEventTypeAction, idleState)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

  // A link a névből képződik, amíg a felhasználó hozzá nem nyúl.
  const effectiveSlug = slugTouched ? slug : slugify(title)

  return (
    <form action={action} className="card p-6">
      <h2 className="text-base font-semibold">Új esemény</h2>
      <p className="mt-1 text-sm text-muted">
        Add meg a nevét és a hosszát — az elérhetőségi sávokat a következő lépésben állítod be.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="title">
            Az esemény neve
          </label>
          <input
            id="title"
            name="title"
            className="field"
            placeholder="pl. Konzultáció"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={120}
          />
          <FieldError state={state} name="title" />
        </div>

        <div>
          <label className="label" htmlFor="durationMin">
            Hossz
          </label>
          <select id="durationMin" name="durationMin" className="field" defaultValue={30}>
            {DURATIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} perc
              </option>
            ))}
          </select>
          <FieldError state={state} name="durationMin" />
        </div>
      </div>

      <div className="mt-4">
        <label className="label" htmlFor="slug">
          Foglalási link
        </label>
        <div className="mt-1.5 flex items-center gap-0 rounded-lg border border-line-strong bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <span className="py-2 pl-3 text-sm whitespace-nowrap text-muted">{appUrl}/</span>
          <input
            id="slug"
            name="slug"
            className="w-full rounded-r-lg border-0 bg-transparent py-2 pr-3 text-sm focus:outline-none"
            placeholder="konzultacio"
            value={effectiveSlug}
            onChange={(event) => {
              setSlugTouched(true)
              setSlug(slugify(event.target.value))
            }}
            maxLength={60}
          />
        </div>
        <p className="hint">Kisbetű, szám és kötőjel. Ezt a linket küldöd majd a vendégeidnek.</p>
        <FieldError state={state} name="slug" />
      </div>

      <div className="mt-5 flex items-center gap-3">
        <SubmitButton pendingLabel="Létrehozás…">Esemény létrehozása</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  )
}
