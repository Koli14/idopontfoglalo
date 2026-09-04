import { prisma } from '@/lib/db'
import { buildIcs } from '@/lib/ics'

/** A foglalás naptárfájlja. A kezelőtoken egyben a hozzáférés is. */
export async function GET(
  _request: Request,
  { params }: RouteContext<'/api/foglalas/[token]/ics'>,
) {
  const { token } = await params

  const booking = await prisma.booking.findUnique({
    where: { manageToken: token },
    include: {
      eventType: {
        select: {
          title: true,
          locationNote: true,
          owner: { select: { name: true, email: true } },
        },
      },
    },
  })

  if (!booking) {
    return new Response('A foglalás nem található.', { status: 404 })
  }

  const ics = buildIcs({
    uid: `${booking.id}@idopontfoglalo`,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    summary: `${booking.eventType.title} — ${booking.guestName}`,
    description: booking.guestNote ?? undefined,
    location: booking.eventType.locationNote ?? undefined,
    organizerName: booking.eventType.owner.name ?? undefined,
    organizerEmail: booking.eventType.owner.email ?? undefined,
    cancelled: booking.status === 'CANCELLED',
    sequence: booking.status === 'CANCELLED' ? 1 : 0,
  })

  return new Response(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="idopont.ics"',
      'Cache-Control': 'no-store',
    },
  })
}
