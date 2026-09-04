import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { eventTypesVisibleTo, requireUser } from '@/lib/auth-guards'
import { formatDuration } from '@/lib/time'
import { appUrl } from '@/lib/urls'
import { NewEventForm } from '@/app/admin/new-event-form'
import { CopyLinkButton } from '@/components/copy-link-button'

export const metadata: Metadata = { title: 'Eseményeim' }

export default async function AdminHomePage() {
  const user = await requireUser()
  const base = appUrl()

  const eventTypes = await prisma.eventType.findMany({
    where: eventTypesVisibleTo(user.id),
    orderBy: { createdAt: 'desc' },
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { bookings: { where: { status: 'CONFIRMED' } } } },
    },
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Eseményeim</h1>
        <p className="mt-1 text-sm text-muted">
          Minden eseménynek saját foglalási linkje, hossza és elérhetősége van.
        </p>
      </div>

      {eventTypes.length === 0 ? (
        <p className="alert-info">
          Még nincs eseményed. Hozz létre egyet alább, és add meg, mikor érsz rá.
        </p>
      ) : (
        <ul className="space-y-3">
          {eventTypes.map((eventType) => {
            const isOwner = eventType.ownerId === user.id
            const url = `${base}/${eventType.slug}`

            return (
              <li key={eventType.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/esemeny/${eventType.id}`}
                        className="text-base font-semibold hover:text-accent"
                      >
                        {eventType.title}
                      </Link>

                      {isOwner ? null : (
                        <span className="badge bg-accent-soft text-accent">Társszervező</span>
                      )}

                      {eventType.isActive ? null : (
                        <span className="badge bg-canvas text-muted">Szünetel</span>
                      )}
                    </div>

                    <p className="mt-1 text-sm text-muted">
                      {formatDuration(eventType.durationMin)}
                      {' · '}
                      {eventType._count.bookings} foglalás
                      {isOwner ? '' : ` · ${eventType.owner.name ?? 'Ismeretlen'} eseménye`}
                    </p>

                    <p className="mt-2 truncate font-mono text-xs text-subtle">{url}</p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <CopyLinkButton url={url} />
                    <Link
                      href={`/admin/esemeny/${eventType.id}/elerhetoseg`}
                      className="btn-secondary"
                    >
                      Elérhetőség
                    </Link>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <NewEventForm appUrl={base.replace(/^https?:\/\//, '')} />
    </div>
  )
}
