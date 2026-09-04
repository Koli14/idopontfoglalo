import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { requireEventAccess } from '@/lib/auth-guards'
import { formatDateTimeRange, formatLongDateWithWeekday, formatTime } from '@/lib/time'
import { CancelBookingForm } from '@/app/admin/esemeny/[id]/foglalasok/cancel-booking-form'

export const metadata: Metadata = { title: 'Foglalások' }

export default async function BookingsPage({
  params,
}: PageProps<'/admin/esemeny/[id]/foglalasok'>) {
  const { id } = await params
  await requireEventAccess(id)

  const eventType = await prisma.eventType.findUnique({
    where: { id },
    select: { timezone: true },
  })

  if (!eventType) notFound()

  const { timezone } = eventType
  const now = new Date()

  const [upcoming, past] = await Promise.all([
    prisma.booking.findMany({
      where: { eventTypeId: id, status: 'CONFIRMED', startsAt: { gte: now } },
      orderBy: { startsAt: 'asc' },
    }),
    prisma.booking.findMany({
      where: {
        eventTypeId: id,
        OR: [{ startsAt: { lt: now } }, { status: 'CANCELLED' }],
      },
      orderBy: { startsAt: 'desc' },
      take: 50,
    }),
  ])

  function BookingRow({ booking }: { booking: (typeof upcoming)[number] }) {
    const when = formatDateTimeRange(booking.startsAt, booking.endsAt, timezone)
    const cancelled = booking.status === 'CANCELLED'

    return (
      <li className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{booking.guestName}</p>
              {cancelled ? (
                <span className="badge bg-danger-soft text-danger">Lemondva</span>
              ) : null}
            </div>

            <p className="mt-1 text-sm text-muted">{when}</p>

            <p className="mt-1 text-sm">
              <a href={`mailto:${booking.guestEmail}`} className="text-accent hover:underline">
                {booking.guestEmail}
              </a>
            </p>

            {booking.guestNote ? (
              <p className="mt-3 rounded-lg border-l-2 border-line-strong bg-canvas px-3 py-2 text-sm whitespace-pre-wrap text-muted">
                {booking.guestNote}
              </p>
            ) : null}

            {cancelled && booking.cancelReason ? (
              <p className="mt-2 text-sm text-muted">
                <span className="font-medium">Lemondás oka:</span> {booking.cancelReason}
              </p>
            ) : null}
          </div>

          {!cancelled && booking.startsAt >= now ? (
            <CancelBookingForm
              eventTypeId={id}
              bookingId={booking.id}
              guestName={booking.guestName}
              when={`${formatLongDateWithWeekday(booking.startsAt, timezone)} ${formatTime(booking.startsAt, timezone)}`}
            />
          ) : null}
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-base font-semibold">
          Közelgő foglalások
          <span className="ml-2 text-sm font-normal text-muted">{upcoming.length}</span>
        </h2>

        {upcoming.length === 0 ? (
          <p className="mt-3 alert-info">
            Még nincs közelgő foglalás. Oszd meg a foglalási linket, hogy időpontot tudjanak
            választani.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {upcoming.map((booking) => (
              <BookingRow key={booking.id} booking={booking} />
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 ? (
        <section>
          <h2 className="text-base font-semibold">Korábbi és lemondott foglalások</h2>
          <ul className="mt-3 space-y-3">
            {past.map((booking) => (
              <BookingRow key={booking.id} booking={booking} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
