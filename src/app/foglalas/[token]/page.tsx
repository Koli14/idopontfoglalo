import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { formatDateTimeRange, formatDuration } from '@/lib/time'
import { GuestCancelForm } from '@/app/foglalas/[token]/cancel-form'

export const metadata: Metadata = { title: 'A foglalásod', robots: { index: false } }

export default async function ManageBookingPage({ params }: PageProps<'/foglalas/[token]'>) {
  const { token } = await params

  const booking = await prisma.booking.findUnique({
    where: { manageToken: token },
    include: {
      eventType: {
        select: {
          title: true,
          slug: true,
          locationNote: true,
          durationMin: true,
          timezone: true,
          owner: { select: { name: true } },
        },
      },
    },
  })

  if (!booking) notFound()

  const { eventType } = booking
  const cancelled = booking.status === 'CANCELLED'
  const past = booking.startsAt <= new Date()

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-12">
      <div className="card p-8">
        {cancelled ? (
          <p className="badge bg-danger-soft text-danger">Lemondva</p>
        ) : past ? (
          <p className="badge bg-canvas text-muted">Lezajlott</p>
        ) : (
          <p className="badge bg-positive-soft text-positive">Megerősítve</p>
        )}

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-balance">
          {cancelled ? 'Ezt az időpontot lemondtuk' : eventType.title}
        </h1>

        <dl className="mt-6 space-y-3 text-sm">
          {cancelled ? (
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-muted">Esemény</dt>
              <dd className="font-medium">{eventType.title}</dd>
            </div>
          ) : null}

          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted">Időpont</dt>
            <dd className="font-medium">
              {formatDateTimeRange(booking.startsAt, booking.endsAt, eventType.timezone)}
            </dd>
          </div>

          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted">Hossz</dt>
            <dd className="font-medium">{formatDuration(eventType.durationMin)}</dd>
          </div>

          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted">Szervező</dt>
            <dd className="font-medium">{eventType.owner.name ?? 'Szervező'}</dd>
          </div>

          {eventType.locationNote ? (
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-muted">Helyszín</dt>
              <dd className="font-medium">{eventType.locationNote}</dd>
            </div>
          ) : null}

          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted">Foglaló</dt>
            <dd className="font-medium">
              {booking.guestName} · {booking.guestEmail}
            </dd>
          </div>

          {booking.guestNote ? (
            <div className="flex gap-2">
              <dt className="w-24 shrink-0 text-muted">Megjegyzés</dt>
              <dd className="whitespace-pre-wrap">{booking.guestNote}</dd>
            </div>
          ) : null}
        </dl>

        {!cancelled && !past ? (
          <>
            <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-6">
              <a href={`/api/foglalas/${token}/ics`} className="btn-secondary" download>
                Mentés a naptáramba
              </a>
            </div>

            <div className="mt-6 border-t border-line pt-6">
              <GuestCancelForm token={token} />
            </div>
          </>
        ) : null}

        {cancelled ? (
          <div className="mt-6 border-t border-line pt-6">
            <Link href={`/${eventType.slug}`} className="btn-primary">
              Új időpont foglalása
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  )
}
