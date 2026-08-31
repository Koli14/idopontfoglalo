import { prisma } from '@/lib/db'
import { buildIcs } from '@/lib/ics'
import { sendMail } from '@/lib/email/send'
import {
  bookingCancelled,
  bookingConfirmedGuest,
  bookingConfirmedHost,
  bookingReminder,
  type BookingEmailData,
} from '@/lib/email/templates'
import { manageBookingUrl } from '@/lib/urls'

/** A levelekhez szükséges foglalás + eseménytípus + címzettek. */
const bookingWithContext = {
  eventType: {
    include: {
      owner: { select: { name: true, email: true } },
      members: {
        where: { acceptedAt: { not: null } },
        select: { user: { select: { email: true } } },
      },
    },
  },
} as const

function loadBooking(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingWithContext,
  })
}

type BookingWithContext = NonNullable<Awaited<ReturnType<typeof loadBooking>>>

function toEmailData(booking: BookingWithContext): BookingEmailData {
  const { eventType } = booking

  return {
    eventTitle: eventType.title,
    hostName: eventType.owner.name ?? 'A szervező',
    guestName: booking.guestName,
    guestEmail: booking.guestEmail,
    guestNote: booking.guestNote,
    locationNote: eventType.locationNote,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    durationMin: eventType.durationMin,
    timezone: eventType.timezone,
    manageUrl: manageBookingUrl(booking.manageToken),
  }
}

/** A szervező és az elfogadott társszervezők e-mail címei. */
function hostRecipients(booking: BookingWithContext): string[] {
  const addresses = [
    booking.eventType.owner.email,
    ...booking.eventType.members.map((member) => member.user?.email ?? null),
  ]

  return [...new Set(addresses.filter((address): address is string => Boolean(address)))]
}

function icsFor(booking: BookingWithContext, cancelled: boolean) {
  return buildIcs({
    uid: `${booking.id}@idopontfoglalo`,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    summary: `${booking.eventType.title} — ${booking.guestName}`,
    description: booking.guestNote ?? undefined,
    location: booking.eventType.locationNote ?? undefined,
    organizerName: booking.eventType.owner.name ?? undefined,
    organizerEmail: booking.eventType.owner.email ?? undefined,
    cancelled,
    sequence: cancelled ? 1 : 0,
  })
}

/** Visszaigazolás a vendégnek, értesítés a szervezőknek. */
export async function notifyBookingCreated(bookingId: string): Promise<void> {
  const booking = await loadBooking(bookingId)
  if (!booking) return

  const data = toEmailData(booking)
  const hosts = hostRecipients(booking)
  const attachments = [{ filename: 'idopont.ics', content: icsFor(booking, false) }]

  const guestMail = bookingConfirmedGuest(data)
  const hostMail = bookingConfirmedHost(data)

  await Promise.all([
    sendMail({
      to: booking.guestEmail,
      ...guestMail,
      replyTo: booking.eventType.owner.email ?? undefined,
      attachments,
    }),
    hosts.length > 0
      ? sendMail({ to: hosts, ...hostMail, replyTo: booking.guestEmail, attachments })
      : Promise.resolve({ sent: false }),
  ])
}

/** Lemondás visszaigazolása mindkét félnek. */
export async function notifyBookingCancelled(
  bookingId: string,
  cancelledBy: 'GUEST' | 'HOST',
): Promise<void> {
  const booking = await loadBooking(bookingId)
  if (!booking) return

  const data = toEmailData(booking)
  const hosts = hostRecipients(booking)
  const attachments = [{ filename: 'idopont.ics', content: icsFor(booking, true) }]

  const guestMail = bookingCancelled({
    ...data,
    cancelledBy,
    audience: 'GUEST',
    reason: booking.cancelReason,
  })
  const hostMail = bookingCancelled({
    ...data,
    cancelledBy,
    audience: 'HOST',
    reason: booking.cancelReason,
  })

  await Promise.all([
    sendMail({ to: booking.guestEmail, ...guestMail, attachments }),
    hosts.length > 0
      ? sendMail({ to: hosts, ...hostMail, attachments })
      : Promise.resolve({ sent: false }),
  ])
}

/** Emlékeztető a vendégnek. A cron hívja. */
export async function sendBookingReminder(bookingId: string): Promise<boolean> {
  const booking = await loadBooking(bookingId)
  if (!booking) return false

  const mail = bookingReminder(toEmailData(booking))

  await sendMail({
    to: booking.guestEmail,
    ...mail,
    replyTo: booking.eventType.owner.email ?? undefined,
    attachments: [{ filename: 'idopont.ics', content: icsFor(booking, false) }],
  })

  return true
}
