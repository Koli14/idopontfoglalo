'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/db'
import { AccessDeniedError, requireEventAccess, requireEventOwner } from '@/lib/auth-guards'
import { cancelBooking } from '@/lib/booking'
import { notifyBookingCancelled } from '@/lib/notifications'
import { sendMail } from '@/lib/email/send'
import { cohostInvite } from '@/lib/email/templates'
import { dateKeyToColumn } from '@/lib/time'
import { adminUrl } from '@/lib/urls'
import {
  availabilityWindowSchema,
  inviteCohostSchema,
  updateEventTypeSchema,
} from '@/lib/validation'
import {
  checkbox,
  errorState,
  optionalNumber,
  parseForm,
  successState,
  text,
  type ActionState,
} from '@/lib/action-result'

/** A jogosultsági hibát űrlaphibává alakítja, hogy ne 500-as oldal legyen. */
async function guard(
  eventTypeId: string,
  check: typeof requireEventAccess,
): Promise<{ ok: true } | { ok: false; state: ActionState }> {
  try {
    await check(eventTypeId)
    return { ok: true }
  } catch (error) {
    if (error instanceof AccessDeniedError) return { ok: false, state: errorState(error.message) }
    throw error
  }
}

function revalidateEvent(eventTypeId: string, slug?: string) {
  revalidatePath('/admin')
  revalidatePath(`/admin/esemeny/${eventTypeId}`)
  revalidatePath(`/admin/esemeny/${eventTypeId}/elerhetoseg`)
  revalidatePath(`/admin/esemeny/${eventTypeId}/foglalasok`)
  revalidatePath(`/admin/esemeny/${eventTypeId}/csapat`)
  if (slug) revalidatePath(`/${slug}`)
}

// ---------------------------------------------------------------------------
// Beállítások
// ---------------------------------------------------------------------------

export async function updateEventTypeAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const eventTypeId = text(form, 'eventTypeId')
  const access = await guard(eventTypeId, requireEventAccess)
  if (!access.ok) return access.state

  const frequencyEnabled = checkbox(form, 'frequencyLimitEnabled')
  const reminderEnabled = checkbox(form, 'reminderEnabled')
  const intervalEnabled = checkbox(form, 'slotIntervalEnabled')

  const parsed = parseForm(updateEventTypeSchema, {
    title: text(form, 'title'),
    slug: text(form, 'slug'),
    description: text(form, 'description'),
    locationNote: text(form, 'locationNote'),
    durationMin: text(form, 'durationMin'),
    bufferBeforeMin: text(form, 'bufferBeforeMin'),
    bufferAfterMin: text(form, 'bufferAfterMin'),
    minimumNoticeMin: text(form, 'minimumNoticeMin'),
    slotIntervalMin: optionalNumber(form, 'slotIntervalMin', intervalEnabled),
    frequencyLimitCount: optionalNumber(form, 'frequencyLimitCount', frequencyEnabled),
    frequencyLimitPeriod: frequencyEnabled ? text(form, 'frequencyLimitPeriod') : null,
    reminderHoursBefore: optionalNumber(form, 'reminderHoursBefore', reminderEnabled),
    isActive: checkbox(form, 'isActive'),
  })

  if (!parsed.ok) return parsed.state

  const taken = await prisma.eventType.findFirst({
    where: { slug: parsed.data.slug, id: { not: eventTypeId } },
    select: { id: true },
  })

  if (taken) {
    return errorState('Ez a link már foglalt, válassz másikat.', {
      slug: 'Ez a link már foglalt, válassz másikat.',
    })
  }

  const updated = await prisma.eventType.update({
    where: { id: eventTypeId },
    data: {
      title: parsed.data.title,
      slug: parsed.data.slug,
      description: parsed.data.description || null,
      locationNote: parsed.data.locationNote || null,
      durationMin: parsed.data.durationMin,
      bufferBeforeMin: parsed.data.bufferBeforeMin,
      bufferAfterMin: parsed.data.bufferAfterMin,
      minimumNoticeMin: parsed.data.minimumNoticeMin,
      slotIntervalMin: parsed.data.slotIntervalMin ?? null,
      frequencyLimitCount: parsed.data.frequencyLimitCount ?? null,
      frequencyLimitPeriod: parsed.data.frequencyLimitPeriod ?? null,
      reminderHoursBefore: parsed.data.reminderHoursBefore ?? null,
      isActive: parsed.data.isActive,
    },
    select: { slug: true },
  })

  revalidateEvent(eventTypeId, updated.slug)

  return successState('A beállítások mentve.')
}

// ---------------------------------------------------------------------------
// Elérhetőségi sávok
// ---------------------------------------------------------------------------

export async function addWindowAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const eventTypeId = text(form, 'eventTypeId')
  const access = await guard(eventTypeId, requireEventAccess)
  if (!access.ok) return access.state

  const parsed = parseForm(availabilityWindowSchema, {
    eventTypeId,
    date: text(form, 'date'),
    startMin: text(form, 'startMin'),
    endMin: text(form, 'endMin'),
  })

  if (!parsed.ok) return parsed.state

  const date = dateKeyToColumn(parsed.data.date)

  // Az átfedő sávokat egyetlen sávvá vonjuk össze, hogy ne legyen két,
  // ugyanazt az idősávot lefedő bejegyzés.
  const sameDay = await prisma.availabilityWindow.findMany({
    where: { eventTypeId, date },
  })

  const overlapping = sameDay.filter(
    (window) => window.startMin <= parsed.data.endMin && parsed.data.startMin <= window.endMin,
  )

  const startMin = Math.min(parsed.data.startMin, ...overlapping.map((w) => w.startMin))
  const endMin = Math.max(parsed.data.endMin, ...overlapping.map((w) => w.endMin))

  await prisma.$transaction([
    prisma.availabilityWindow.deleteMany({
      where: { id: { in: overlapping.map((window) => window.id) } },
    }),
    prisma.availabilityWindow.create({ data: { eventTypeId, date, startMin, endMin } }),
  ])

  revalidateEvent(eventTypeId)

  return successState('Sáv hozzáadva.')
}

export async function deleteWindowAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const eventTypeId = text(form, 'eventTypeId')
  const windowId = text(form, 'windowId')
  const access = await guard(eventTypeId, requireEventAccess)
  if (!access.ok) return access.state

  await prisma.availabilityWindow.deleteMany({ where: { id: windowId, eventTypeId } })

  revalidateEvent(eventTypeId)

  return successState('Sáv törölve.')
}

/** Egy nap összes sávjának törlése. */
export async function clearDayAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const eventTypeId = text(form, 'eventTypeId')
  const date = text(form, 'date')
  const access = await guard(eventTypeId, requireEventAccess)
  if (!access.ok) return access.state

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return errorState('Érvénytelen dátum.')

  await prisma.availabilityWindow.deleteMany({
    where: { eventTypeId, date: dateKeyToColumn(date) },
  })

  revalidateEvent(eventTypeId)

  return successState('A nap sávjai törölve.')
}

/**
 * Egy nap sávjainak átmásolása több másik napra — így nem kell minden napot
 * kézzel felvenni, miközben a sávok dátumhoz kötöttek maradnak.
 */
export async function copyDayAction(_previous: ActionState, form: FormData): Promise<ActionState> {
  const eventTypeId = text(form, 'eventTypeId')
  const source = text(form, 'sourceDate')
  const targets = form
    .getAll('targetDates')
    .filter((value): value is string => typeof value === 'string')

  const access = await guard(eventTypeId, requireEventAccess)
  if (!access.ok) return access.state

  if (!/^\d{4}-\d{2}-\d{2}$/.test(source)) return errorState('Érvénytelen forrásdátum.')

  const validTargets = targets.filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date !== source)

  if (validTargets.length === 0) {
    return errorState('Válassz legalább egy napot, amire másoljuk a sávokat.')
  }

  const sourceWindows = await prisma.availabilityWindow.findMany({
    where: { eventTypeId, date: dateKeyToColumn(source) },
    orderBy: { startMin: 'asc' },
  })

  if (sourceWindows.length === 0) {
    return errorState('Ezen a napon nincs másolható sáv.')
  }

  const targetDates = validTargets.map(dateKeyToColumn)

  await prisma.$transaction([
    // A célnapokat felülírjuk, hogy a másolás eredménye kiszámítható legyen.
    prisma.availabilityWindow.deleteMany({
      where: { eventTypeId, date: { in: targetDates } },
    }),
    prisma.availabilityWindow.createMany({
      data: targetDates.flatMap((date) =>
        sourceWindows.map((window) => ({
          eventTypeId,
          date,
          startMin: window.startMin,
          endMin: window.endMin,
        })),
      ),
    }),
  ])

  revalidateEvent(eventTypeId)

  return successState(`Sávok másolva ${validTargets.length} napra.`)
}

// ---------------------------------------------------------------------------
// Társszervezők
// ---------------------------------------------------------------------------

export async function inviteCohostAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const eventTypeId = text(form, 'eventTypeId')

  let inviterId: string
  try {
    inviterId = (await requireEventOwner(eventTypeId)).userId
  } catch (error) {
    if (error instanceof AccessDeniedError) return errorState(error.message)
    throw error
  }

  const parsed = parseForm(inviteCohostSchema, {
    eventTypeId,
    email: text(form, 'email'),
  })

  if (!parsed.ok) return parsed.state

  const eventType = await prisma.eventType.findUniqueOrThrow({
    where: { id: eventTypeId },
    select: { title: true, owner: { select: { name: true, email: true } } },
  })

  if (eventType.owner.email?.toLowerCase() === parsed.data.email) {
    return errorState('Ez a saját e-mail címed — te vagy az esemény tulajdonosa.', {
      email: 'Ez a saját e-mail címed.',
    })
  }

  const existing = await prisma.eventTypeMember.findUnique({
    where: { eventTypeId_invitedEmail: { eventTypeId, invitedEmail: parsed.data.email } },
    select: { id: true },
  })

  if (existing) {
    return errorState('Ezt a címet már meghívtad.', { email: 'Ezt a címet már meghívtad.' })
  }

  // Ha a meghívott már regisztrált, azonnal összekötjük a fiókjával.
  const invitedUser = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  })

  await prisma.eventTypeMember.create({
    data: {
      eventTypeId,
      invitedEmail: parsed.data.email,
      userId: invitedUser?.id ?? null,
      acceptedAt: invitedUser ? new Date() : null,
      invitedById: inviterId,
      role: 'COHOST',
    },
  })

  const mail = cohostInvite({
    eventTitle: eventType.title,
    inviterName: eventType.owner.name ?? 'A szervező',
    adminUrl: adminUrl(),
  })

  await sendMail({ to: parsed.data.email, ...mail })

  revalidateEvent(eventTypeId)

  return successState(
    invitedUser
      ? 'A társszervező hozzáadva — máris szerkesztheti az eseményt.'
      : 'Meghívó elküldve. A hozzáférés az első Google-belépéskor aktiválódik.',
  )
}

export async function removeCohostAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const eventTypeId = text(form, 'eventTypeId')
  const memberId = text(form, 'memberId')

  try {
    await requireEventOwner(eventTypeId)
  } catch (error) {
    if (error instanceof AccessDeniedError) return errorState(error.message)
    throw error
  }

  await prisma.eventTypeMember.deleteMany({ where: { id: memberId, eventTypeId } })

  revalidateEvent(eventTypeId)

  return successState('A társszervező eltávolítva.')
}

// ---------------------------------------------------------------------------
// Foglalások
// ---------------------------------------------------------------------------

export async function cancelBookingAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const eventTypeId = text(form, 'eventTypeId')
  const bookingId = text(form, 'bookingId')
  const access = await guard(eventTypeId, requireEventAccess)
  if (!access.ok) return access.state

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, eventTypeId },
    select: { id: true },
  })

  if (!booking) return errorState('A foglalás nem található.')

  const result = await cancelBooking(bookingId, text(form, 'reason'))

  if (!result.ok) return errorState(result.message)

  await notifyBookingCancelled(bookingId, 'HOST')

  revalidateEvent(eventTypeId)

  return successState('A foglalás lemondva, a vendéget értesítettük.')
}
