import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { requireEventAccess } from '@/lib/auth-guards'
import { TeamManager } from '@/app/admin/esemeny/[id]/csapat/team-manager'

export const metadata: Metadata = { title: 'Csapat' }

export default async function TeamPage({ params }: PageProps<'/admin/esemeny/[id]/csapat'>) {
  const { id } = await params
  const { isOwner } = await requireEventAccess(id)

  const eventType = await prisma.eventType.findUnique({
    where: { id },
    select: {
      owner: { select: { name: true, email: true } },
      members: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          invitedEmail: true,
          acceptedAt: true,
          user: { select: { name: true } },
        },
      },
    },
  })

  if (!eventType) notFound()

  if (!isOwner) {
    return (
      <div className="space-y-4">
        <p className="alert-info">
          A csapat kezelése az esemény tulajdonosának joga. Társszervezőként az elérhetőséget és a
          foglalásokat szerkesztheted.
        </p>

        <section className="card p-6">
          <h2 className="text-base font-semibold">Az esemény csapata</h2>
          <ul className="mt-4 divide-y divide-line">
            <li className="flex items-center justify-between gap-3 py-3">
              <span className="text-sm">{eventType.owner.name ?? eventType.owner.email}</span>
              <span className="badge bg-canvas text-muted">Tulajdonos</span>
            </li>
            {eventType.members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm">{member.user?.name ?? member.invitedEmail}</span>
                <span className="badge bg-canvas text-muted">
                  {member.acceptedAt ? 'Társszervező' : 'Meghívó elküldve'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    )
  }

  return (
    <TeamManager
      eventTypeId={id}
      ownerName={eventType.owner.name ?? 'Te'}
      ownerEmail={eventType.owner.email ?? ''}
      members={eventType.members.map((member) => ({
        id: member.id,
        invitedEmail: member.invitedEmail,
        name: member.user?.name ?? null,
        accepted: member.acceptedAt !== null,
      }))}
    />
  )
}
