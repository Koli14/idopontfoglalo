'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireUser, requireEventOwner, AccessDeniedError } from '@/lib/auth-guards'
import { createEventTypeSchema, slugify } from '@/lib/validation'
import { errorState, parseForm, text, type ActionState } from '@/lib/action-result'

export async function createEventTypeAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser()

  const title = text(form, 'title')
  // Ha nincs kézzel megadott link, a névből képezzük.
  const slug = text(form, 'slug').trim() || slugify(title)

  const parsed = parseForm(createEventTypeSchema, {
    title,
    slug,
    durationMin: text(form, 'durationMin'),
  })

  if (!parsed.ok) return parsed.state

  const existing = await prisma.eventType.findUnique({
    where: { slug: parsed.data.slug },
    select: { id: true },
  })

  if (existing) {
    return errorState('Ez a link már foglalt, válassz másikat.', {
      slug: 'Ez a link már foglalt, válassz másikat.',
    })
  }

  const created = await prisma.eventType.create({
    data: {
      title: parsed.data.title,
      slug: parsed.data.slug,
      durationMin: parsed.data.durationMin,
      ownerId: user.id,
    },
    select: { id: true },
  })

  revalidatePath('/admin')
  redirect(`/admin/esemeny/${created.id}/elerhetoseg`)
}

export async function deleteEventTypeAction(
  _previous: ActionState,
  form: FormData,
): Promise<ActionState> {
  const eventTypeId = text(form, 'eventTypeId')

  try {
    await requireEventOwner(eventTypeId)
  } catch (error) {
    if (error instanceof AccessDeniedError) return errorState(error.message)
    throw error
  }

  await prisma.eventType.delete({ where: { id: eventTypeId } })

  revalidatePath('/admin')
  redirect('/admin')
}
