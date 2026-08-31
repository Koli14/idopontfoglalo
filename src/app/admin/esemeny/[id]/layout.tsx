import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { AccessDeniedError, requireEventAccess } from '@/lib/auth-guards'
import { formatDuration } from '@/lib/time'
import { appUrl } from '@/lib/urls'
import { CopyLinkButton } from '@/components/copy-link-button'
import { EventTabs } from '@/components/event-tabs'

export default async function EventLayout({
  children,
  params,
}: LayoutProps<'/admin/esemeny/[id]'>) {
  const { id } = await params

  try {
    await requireEventAccess(id)
  } catch (error) {
    if (error instanceof AccessDeniedError) notFound()
    throw error
  }

  const eventType = await prisma.eventType.findUnique({
    where: { id },
    select: { id: true, title: true, slug: true, durationMin: true, isActive: true },
  })

  if (!eventType) notFound()

  const url = `${appUrl()}/${eventType.slug}`

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-muted hover:text-ink">
          ← Minden esemény
        </Link>

        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{eventType.title}</h1>
              {eventType.isActive ? null : (
                <span className="badge bg-canvas text-muted">Szünetel</span>
              )}
            </div>
            <p className="mt-1 text-sm text-muted">
              {formatDuration(eventType.durationMin)}
              {' · '}
              <a href={url} className="font-mono text-xs hover:text-accent">
                {url.replace(/^https?:\/\//, '')}
              </a>
            </p>
          </div>

          <CopyLinkButton url={url} label="Foglalási link másolása" />
        </div>
      </div>

      <EventTabs eventTypeId={eventType.id} />

      {children}
    </div>
  )
}
