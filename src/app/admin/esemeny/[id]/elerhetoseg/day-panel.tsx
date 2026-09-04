'use client'

import { useActionState, useState } from 'react'
import {
  addWindowAction,
  clearDayAction,
  copyDayAction,
  deleteWindowAction,
} from '@/app/admin/esemeny/[id]/actions'
import { FieldError, FormMessage, SubmitButton } from '@/components/form'
import { idleState } from '@/lib/action-result'
import { labelToMinutes, minutesToLabel } from '@/lib/time'

export type DayWindow = {
  id: string
  startMin: number
  endMin: number
}

export type PreviewSlot = {
  label: string
  available: boolean
  reason?: string
}

export type CopyTarget = {
  dateKey: string
  label: string
  hasWindows: boolean
}

const REASON_LABELS: Record<string, string> = {
  BOOKED: 'foglalt',
  PAST: 'elmúlt',
  TOO_SOON: 'túl közeli',
  FREQUENCY_LIMIT: 'limit betelt',
}

export function DayPanel({
  eventTypeId,
  dateKey,
  dateLabel,
  windows,
  slots,
  copyTargets,
}: {
  eventTypeId: string
  dateKey: string
  dateLabel: string
  windows: DayWindow[]
  slots: PreviewSlot[]
  copyTargets: CopyTarget[]
}) {
  const [addState, addAction] = useActionState(addWindowAction, idleState)
  const [deleteState, deleteAction] = useActionState(deleteWindowAction, idleState)
  const [clearState, clearAction] = useActionState(clearDayAction, idleState)
  const [copyState, copyAction] = useActionState(copyDayAction, idleState)

  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('12:00')
  const [showCopy, setShowCopy] = useState(false)

  const startMin = labelToMinutes(startTime)
  const endMin = labelToMinutes(endTime)
  const rangeValid = startMin !== null && endMin !== null && endMin > startMin

  const availableCount = slots.filter((slot) => slot.available).length

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">{dateLabel}</h2>
        <p className="mt-1 text-sm text-muted">
          {windows.length === 0
            ? 'Ezen a napon nincs elérhetőség.'
            : `${windows.length} sáv · ${availableCount} foglalható időpont`}
        </p>
      </div>

      {/* Meglévő sávok */}
      {windows.length > 0 ? (
        <ul className="space-y-2">
          {windows.map((window) => (
            <li
              key={window.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-line bg-canvas px-3 py-2"
            >
              <span className="font-mono text-sm">
                {minutesToLabel(window.startMin)} – {minutesToLabel(window.endMin)}
              </span>

              <form action={deleteAction}>
                <input type="hidden" name="eventTypeId" value={eventTypeId} />
                <input type="hidden" name="windowId" value={window.id} />
                <SubmitButton variant="secondary" pendingLabel="…">
                  Törlés
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      ) : null}

      <FormMessage state={deleteState} />

      {/* Új sáv */}
      <form action={addAction} className="rounded-lg border border-line p-4">
        <h3 className="text-sm font-medium">Új sáv hozzáadása</h3>

        <input type="hidden" name="eventTypeId" value={eventTypeId} />
        <input type="hidden" name="date" value={dateKey} />
        <input type="hidden" name="startMin" value={startMin ?? ''} />
        <input type="hidden" name="endMin" value={endMin ?? ''} />

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label className="label text-xs" htmlFor="startTime">
              Kezdés
            </label>
            <input
              id="startTime"
              type="time"
              className="field w-32"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
              step={300}
              required
            />
          </div>

          <div>
            <label className="label text-xs" htmlFor="endTime">
              Vége
            </label>
            <input
              id="endTime"
              type="time"
              className="field w-32"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
              step={300}
              required
            />
          </div>

          <SubmitButton pendingLabel="Hozzáadás…">Hozzáadás</SubmitButton>
        </div>

        {!rangeValid ? (
          <p className="mt-2 text-xs font-medium text-danger">
            A sáv vége legyen későbbi a kezdeténél.
          </p>
        ) : null}

        <FieldError state={addState} name="endMin" />
        <div className="mt-3">
          <FormMessage state={addState} />
        </div>
      </form>

      {/* Előnézet */}
      {slots.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium">Ebből ezek az időpontok lesznek</h3>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {slots.map((slot) => (
              <li
                key={slot.label}
                title={slot.available ? 'Foglalható' : REASON_LABELS[slot.reason ?? '']}
                className={`rounded-md border px-2 py-1 font-mono text-xs ${
                  slot.available
                    ? 'border-accent-line bg-accent-soft text-accent'
                    : 'border-line bg-canvas text-subtle line-through'
                }`}
              >
                {slot.label}
              </li>
            ))}
          </ul>
          <p className="hint">
            Az áthúzott időpontok nem foglalhatók (foglalt, elmúlt, túl közeli vagy betelt a limit).
          </p>
        </div>
      ) : null}

      {/* Másolás és ürítés */}
      {windows.length > 0 ? (
        <div className="space-y-3 border-t border-line pt-4">
          <button
            type="button"
            className="btn-ghost !px-0"
            onClick={() => setShowCopy((value) => !value)}
            aria-expanded={showCopy}
          >
            {showCopy ? 'Másolás elrejtése' : 'Sávok másolása más napokra'}
          </button>

          {showCopy ? (
            <form action={copyAction} className="rounded-lg border border-line p-4">
              <input type="hidden" name="eventTypeId" value={eventTypeId} />
              <input type="hidden" name="sourceDate" value={dateKey} />

              <p className="text-sm text-muted">
                A kiválasztott napok elérhetősége felülíródik ennek a napnak a sávjaival.
              </p>

              <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                {copyTargets.map((target) => (
                  <label
                    key={target.dateKey}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs has-checked:border-accent has-checked:bg-accent-soft"
                    title={target.hasWindows ? 'Ezen a napon már van sáv — felülíródik' : undefined}
                  >
                    <input
                      type="checkbox"
                      name="targetDates"
                      value={target.dateKey}
                      className="size-3.5"
                    />
                    <span className={target.hasWindows ? 'font-semibold' : ''}>{target.label}</span>
                  </label>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <SubmitButton pendingLabel="Másolás…">Másolás</SubmitButton>
                <FormMessage state={copyState} />
              </div>
            </form>
          ) : null}

          <form action={clearAction}>
            <input type="hidden" name="eventTypeId" value={eventTypeId} />
            <input type="hidden" name="date" value={dateKey} />
            <SubmitButton
              variant="danger"
              pendingLabel="Törlés…"
              confirm={`Biztosan törlöd ${dateLabel} összes sávját?`}
            >
              A nap összes sávjának törlése
            </SubmitButton>
          </form>
          <FormMessage state={clearState} />
        </div>
      ) : null}
    </div>
  )
}
