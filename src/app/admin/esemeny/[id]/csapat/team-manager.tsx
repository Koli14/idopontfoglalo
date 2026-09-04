'use client'

import { useActionState } from 'react'
import { inviteCohostAction, removeCohostAction } from '@/app/admin/esemeny/[id]/actions'
import { FieldError, FormMessage, SubmitButton } from '@/components/form'
import { idleState } from '@/lib/action-result'

export type TeamMember = {
  id: string
  invitedEmail: string
  name: string | null
  accepted: boolean
}

export function TeamManager({
  eventTypeId,
  members,
  ownerName,
  ownerEmail,
}: {
  eventTypeId: string
  members: TeamMember[]
  ownerName: string
  ownerEmail: string
}) {
  const [inviteState, inviteAction] = useActionState(inviteCohostAction, idleState)
  const [removeState, removeAction] = useActionState(removeCohostAction, idleState)

  return (
    <div className="space-y-6">
      <section className="card p-6">
        <h2 className="text-base font-semibold">Csapat</h2>
        <p className="mt-1 text-sm text-muted">
          A társszervezők szerkeszthetik a beállításokat és az elérhetőségi sávokat, és láthatják,
          lemondhatják a foglalásokat. Az esemény törlése és a csapat kezelése a tulajdonosé marad.
        </p>

        <ul className="mt-5 divide-y divide-line">
          <li className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="text-sm font-medium">{ownerName}</p>
              <p className="text-sm text-muted">{ownerEmail}</p>
            </div>
            <span className="badge bg-canvas text-muted">Tulajdonos</span>
          </li>

          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{member.name ?? member.invitedEmail}</p>
                {member.name ? <p className="text-sm text-muted">{member.invitedEmail}</p> : null}
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={
                    member.accepted
                      ? 'badge bg-positive-soft text-positive'
                      : 'badge bg-warning-soft text-warning'
                  }
                >
                  {member.accepted ? 'Társszervező' : 'Meghívó elküldve'}
                </span>

                <form action={removeAction}>
                  <input type="hidden" name="eventTypeId" value={eventTypeId} />
                  <input type="hidden" name="memberId" value={member.id} />
                  <SubmitButton
                    variant="secondary"
                    pendingLabel="…"
                    confirm={`Biztosan visszavonod ${member.invitedEmail} hozzáférését?`}
                  >
                    Eltávolítás
                  </SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>

        {members.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Még nincs társszervező ezen az eseményen.</p>
        ) : null}

        <div className="mt-4">
          <FormMessage state={removeState} />
        </div>
      </section>

      <form action={inviteAction} className="card p-6">
        <h2 className="text-base font-semibold">Társszervező meghívása</h2>
        <p className="mt-1 text-sm text-muted">
          Add meg annak a Google-fióknak az e-mail címét, amellyel be fog lépni. Ha még nem
          regisztrált, a hozzáférés az első belépéskor aktiválódik.
        </p>

        <input type="hidden" name="eventTypeId" value={eventTypeId} />

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <label className="label" htmlFor="email">
              E-mail cím
            </label>
            <input
              id="email"
              name="email"
              type="email"
              className="field"
              placeholder="kolléga@example.com"
              required
              maxLength={200}
            />
            <FieldError state={inviteState} name="email" />
          </div>

          <SubmitButton pendingLabel="Küldés…">Meghívó küldése</SubmitButton>
        </div>

        <div className="mt-4">
          <FormMessage state={inviteState} />
        </div>
      </form>
    </div>
  )
}
