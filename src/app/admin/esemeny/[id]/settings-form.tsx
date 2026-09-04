'use client'

import { useActionState, useState } from 'react'
import { updateEventTypeAction } from '@/app/admin/esemeny/[id]/actions'
import { FieldError, FormMessage, SubmitButton } from '@/components/form'
import { Toggle } from '@/components/toggle'
import { idleState } from '@/lib/action-result'
import { formatDuration } from '@/lib/time'

const DURATIONS = [15, 20, 30, 45, 60, 90, 120]
const BUFFERS = [0, 5, 10, 15, 20, 30, 45, 60]
const NOTICES = [0, 60, 120, 240, 360, 720, 1440, 2880, 4320, 10080]
const REMINDERS = [1, 2, 3, 6, 12, 24, 48, 72, 168]
const PERIODS = [
  { value: 'DAY', label: 'nap' },
  { value: 'WEEK', label: 'hét' },
  { value: 'MONTH', label: 'hónap' },
]

function noticeLabel(minutes: number) {
  if (minutes === 0) return 'Nincs korlátozás'
  if (minutes < 1440) return formatDuration(minutes)
  const days = minutes / 1440
  return days === 1 ? '1 nap' : `${days} nap`
}

function reminderLabel(hours: number) {
  if (hours < 24) return hours === 1 ? '1 órával előtte' : `${hours} órával előtte`
  const days = hours / 24
  return days === 1 ? '1 nappal előtte' : `${days} nappal előtte`
}

export type SettingsFormEventType = {
  id: string
  title: string
  slug: string
  description: string | null
  locationNote: string | null
  durationMin: number
  bufferBeforeMin: number
  bufferAfterMin: number
  minimumNoticeMin: number
  slotIntervalMin: number | null
  frequencyLimitCount: number | null
  frequencyLimitPeriod: 'DAY' | 'WEEK' | 'MONTH' | null
  reminderHoursBefore: number | null
  isActive: boolean
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="card p-6">
      <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  )
}

export function SettingsForm({
  eventType,
  appHost,
}: {
  eventType: SettingsFormEventType
  appHost: string
}) {
  const [state, action] = useActionState(updateEventTypeAction, idleState)
  const [frequencyEnabled, setFrequencyEnabled] = useState(eventType.frequencyLimitCount !== null)
  const [reminderEnabled, setReminderEnabled] = useState(eventType.reminderHoursBefore !== null)
  const [intervalEnabled, setIntervalEnabled] = useState(eventType.slotIntervalMin !== null)

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="eventTypeId" value={eventType.id} />

      <Section title="Alapadatok">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="title">
              Az esemény neve
            </label>
            <input
              id="title"
              name="title"
              className="field"
              defaultValue={eventType.title}
              required
              maxLength={120}
            />
            <FieldError state={state} name="title" />
          </div>

          <div>
            <label className="label" htmlFor="durationMin">
              A megbeszélés hossza
            </label>
            <select
              id="durationMin"
              name="durationMin"
              className="field"
              defaultValue={eventType.durationMin}
            >
              {[...new Set([...DURATIONS, eventType.durationMin])]
                .sort((a, b) => a - b)
                .map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {formatDuration(minutes)}
                  </option>
                ))}
            </select>
            <FieldError state={state} name="durationMin" />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="slug">
            Foglalási link
          </label>
          <div className="mt-1.5 flex items-center rounded-lg border border-line-strong bg-surface focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
            <span className="py-2 pl-3 text-sm whitespace-nowrap text-muted">{appHost}/</span>
            <input
              id="slug"
              name="slug"
              className="w-full rounded-r-lg border-0 bg-transparent py-2 pr-3 text-sm focus:outline-none"
              defaultValue={eventType.slug}
              required
              maxLength={60}
            />
          </div>
          <FieldError state={state} name="slug" />
        </div>

        <div>
          <label className="label" htmlFor="description">
            Leírás
          </label>
          <textarea
            id="description"
            name="description"
            className="field"
            rows={3}
            defaultValue={eventType.description ?? ''}
            placeholder="Mit érdemes tudni a megbeszélésről? Ez a foglalóoldalon jelenik meg."
            maxLength={2000}
          />
          <FieldError state={state} name="description" />
        </div>

        <div>
          <label className="label" htmlFor="locationNote">
            Helyszín
          </label>
          <input
            id="locationNote"
            name="locationNote"
            className="field"
            defaultValue={eventType.locationNote ?? ''}
            placeholder="pl. Google Meet — a linket a visszaigazolóban küldjük"
            maxLength={300}
          />
          <FieldError state={state} name="locationNote" />
        </div>
      </Section>

      <Section title="Elérhetőségi beállítások">
        <div>
          <Toggle
            name="frequencyLimitEnabled"
            label="Foglalási gyakoriság korlátozása"
            description="Legfeljebb ennyi foglalás fogadható el a megadott időszakban."
            checked={frequencyEnabled}
            onChange={setFrequencyEnabled}
          />

          {frequencyEnabled ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 pl-1">
              <input
                type="number"
                name="frequencyLimitCount"
                className="field !mt-0 w-24"
                min={1}
                max={100}
                defaultValue={eventType.frequencyLimitCount ?? 3}
                aria-label="Foglalások száma"
              />
              <span className="text-sm text-muted">per</span>
              <select
                name="frequencyLimitPeriod"
                className="field !mt-0 w-36"
                defaultValue={eventType.frequencyLimitPeriod ?? 'DAY'}
                aria-label="Időszak"
              >
                {PERIODS.map((period) => (
                  <option key={period.value} value={period.value}>
                    {period.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <FieldError state={state} name="frequencyLimitCount" />
        </div>

        <div className="border-t border-line pt-5">
          <label className="label" htmlFor="minimumNoticeMin">
            Minimális előfoglalási idő
          </label>
          <p className="hint">
            Ennél közelebbi időpontra már nem lehet foglalni — marad időd felkészülni.
          </p>
          <select
            id="minimumNoticeMin"
            name="minimumNoticeMin"
            className="field max-w-xs"
            defaultValue={eventType.minimumNoticeMin}
          >
            {[...new Set([...NOTICES, eventType.minimumNoticeMin])]
              .sort((a, b) => a - b)
              .map((minutes) => (
                <option key={minutes} value={minutes}>
                  {noticeLabel(minutes)}
                </option>
              ))}
          </select>
          <FieldError state={state} name="minimumNoticeMin" />
        </div>

        <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="bufferBeforeMin">
              Szünet az esemény előtt
            </label>
            <select
              id="bufferBeforeMin"
              name="bufferBeforeMin"
              className="field"
              defaultValue={eventType.bufferBeforeMin}
            >
              {[...new Set([...BUFFERS, eventType.bufferBeforeMin])]
                .sort((a, b) => a - b)
                .map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes === 0 ? 'Nincs' : formatDuration(minutes)}
                  </option>
                ))}
            </select>
            <FieldError state={state} name="bufferBeforeMin" />
          </div>

          <div>
            <label className="label" htmlFor="bufferAfterMin">
              Szünet az esemény után
            </label>
            <select
              id="bufferAfterMin"
              name="bufferAfterMin"
              className="field"
              defaultValue={eventType.bufferAfterMin}
            >
              {[...new Set([...BUFFERS, eventType.bufferAfterMin])]
                .sort((a, b) => a - b)
                .map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes === 0 ? 'Nincs' : formatDuration(minutes)}
                  </option>
                ))}
            </select>
            <FieldError state={state} name="bufferAfterMin" />
          </div>
        </div>

        <div className="border-t border-line pt-5">
          <Toggle
            name="slotIntervalEnabled"
            label="Egyedi lépésköz"
            description="Alapból a hossz és a szünetek összege szerint követik egymást az időpontok."
            checked={intervalEnabled}
            onChange={setIntervalEnabled}
          />

          {intervalEnabled ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 pl-1">
              <input
                type="number"
                name="slotIntervalMin"
                className="field !mt-0 w-28"
                min={5}
                max={600}
                step={5}
                defaultValue={eventType.slotIntervalMin ?? 30}
                aria-label="Lépésköz percben"
              />
              <span className="text-sm text-muted">percenként induljon egy időpont</span>
            </div>
          ) : null}
          <FieldError state={state} name="slotIntervalMin" />
        </div>
      </Section>

      <Section title="Értesítések">
        <div>
          <Toggle
            name="reminderEnabled"
            label="Emlékeztető e-mail"
            description="A vendég automatikus emlékeztetőt kap a közelgő időpontról."
            checked={reminderEnabled}
            onChange={setReminderEnabled}
          />

          {reminderEnabled ? (
            <div className="mt-3 pl-1">
              <select
                name="reminderHoursBefore"
                className="field !mt-0 max-w-xs"
                defaultValue={eventType.reminderHoursBefore ?? 24}
                aria-label="Emlékeztető időzítése"
              >
                {[...new Set([...REMINDERS, eventType.reminderHoursBefore ?? 24])]
                  .sort((a, b) => a - b)
                  .map((hours) => (
                    <option key={hours} value={hours}>
                      {reminderLabel(hours)}
                    </option>
                  ))}
              </select>
            </div>
          ) : null}
          <FieldError state={state} name="reminderHoursBefore" />
        </div>

        <p className="hint border-t border-line pt-5">
          A visszaigazoló és a lemondási értesítő automatikusan kimegy mindkét félnek — ezeket nem
          kell külön bekapcsolni.
        </p>
      </Section>

      <Section title="Állapot">
        <Toggle
          name="isActive"
          label="Foglalható"
          description="Kikapcsolva a foglalási link elérhető marad, de nem lehet rajta időpontot foglalni."
          defaultChecked={eventType.isActive}
        />
      </Section>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-line bg-canvas/90 py-4 backdrop-blur">
        <SubmitButton pendingLabel="Mentés…">Beállítások mentése</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  )
}
