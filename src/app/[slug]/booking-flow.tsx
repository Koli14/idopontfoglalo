'use client'

import { useActionState, useState } from 'react'
import { createBookingAction } from '@/app/[slug]/actions'
import { FieldError, FormMessage, SubmitButton } from '@/components/form'
import { idleState } from '@/lib/action-result'

export type PublicSlot = {
  /** ISO pillanat — ezt küldjük a szervernek. */
  value: string
  /** '09:00' */
  time: string
  /** '09:00 – 09:45' */
  range: string
}

export type PublicDay = {
  dateKey: string
  /** '3.' */
  dayNumber: string
  /** 'cs' */
  weekday: string
  /** '2026. szeptember 3., csütörtök' */
  longLabel: string
  /** 'szeptember' */
  monthLabel: string
  slots: PublicSlot[]
}

export function BookingFlow({
  eventTypeId,
  slug,
  days,
}: {
  eventTypeId: string
  slug: string
  days: PublicDay[]
}) {
  const [state, action] = useActionState(createBookingAction, idleState)
  const [selectedDate, setSelectedDate] = useState(days[0]?.dateKey ?? '')
  const [selectedSlot, setSelectedSlot] = useState<PublicSlot | null>(null)

  if (days.length === 0) {
    return (
      <p className="alert-info">
        Jelenleg nincs szabad időpont. Nézz vissza később, vagy keresd a szervezőt.
      </p>
    )
  }

  const activeDay = days.find((day) => day.dateKey === selectedDate) ?? days[0]

  return (
    <div className="space-y-6">
      {/* Nap választása */}
      <div>
        <h2 className="text-sm font-semibold">1. Válassz napot</h2>
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-2">
          {days.map((day) => {
            const active = day.dateKey === activeDay.dateKey

            return (
              <li key={day.dateKey}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate(day.dateKey)
                    setSelectedSlot(null)
                  }}
                  aria-pressed={active}
                  className={`flex w-16 shrink-0 flex-col items-center rounded-lg border px-2 py-2 transition ${
                    active
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line hover:border-line-strong hover:bg-canvas'
                  }`}
                >
                  <span className="text-[11px] text-muted uppercase">{day.weekday}</span>
                  <span className="text-lg leading-tight font-semibold">{day.dayNumber}</span>
                  <span className="text-[10px] text-muted">{day.slots.length} idő</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Időpont választása */}
      <div>
        <h2 className="text-sm font-semibold">2. Válassz időpontot</h2>
        <p className="mt-1 text-sm text-muted">{activeDay.longLabel}</p>

        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {activeDay.slots.map((slot) => {
            const active = selectedSlot?.value === slot.value

            return (
              <li key={slot.value}>
                <button
                  type="button"
                  onClick={() => setSelectedSlot(slot)}
                  aria-pressed={active}
                  className={`w-full rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? 'border-accent bg-accent text-white'
                      : 'border-line-strong hover:border-accent hover:text-accent'
                  }`}
                >
                  {slot.time}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Adatok */}
      {selectedSlot ? (
        <form action={action} className="card space-y-4 p-5">
          <input type="hidden" name="eventTypeId" value={eventTypeId} />
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="startsAt" value={selectedSlot.value} />

          <div>
            <h2 className="text-sm font-semibold">3. Add meg az adataidat</h2>
            <p className="mt-1 text-sm text-muted">
              {activeDay.longLabel} · {selectedSlot.range}
            </p>
          </div>

          <div>
            <label className="label" htmlFor="guestName">
              Neved
            </label>
            <input
              id="guestName"
              name="guestName"
              className="field"
              required
              maxLength={120}
              autoComplete="name"
            />
            <FieldError state={state} name="guestName" />
          </div>

          <div>
            <label className="label" htmlFor="guestEmail">
              E-mail címed
            </label>
            <input
              id="guestEmail"
              name="guestEmail"
              type="email"
              className="field"
              required
              maxLength={200}
              autoComplete="email"
            />
            <p className="hint">Ide küldjük a visszaigazolást és az emlékeztetőt.</p>
            <FieldError state={state} name="guestEmail" />
          </div>

          <div>
            <label className="label" htmlFor="guestNote">
              Megjegyzés <span className="font-normal text-muted">(nem kötelező)</span>
            </label>
            <textarea
              id="guestNote"
              name="guestNote"
              className="field"
              rows={3}
              maxLength={2000}
              placeholder="Miről szeretnél beszélni?"
            />
            <FieldError state={state} name="guestNote" />
          </div>

          <FormMessage state={state} />

          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pendingLabel="Foglalás…">Időpont lefoglalása</SubmitButton>
            <button type="button" className="btn-ghost" onClick={() => setSelectedSlot(null)}>
              Mégsem
            </button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
