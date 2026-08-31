import { z } from 'zod'
import { MINUTES_PER_DAY } from '@/lib/time'

/** Magyar ékezetek átírása a slug képzéséhez. */
const ACCENTS: Record<string, string> = {
  á: 'a',
  é: 'e',
  í: 'i',
  ó: 'o',
  ö: 'o',
  ő: 'o',
  ú: 'u',
  ü: 'u',
  ű: 'u',
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[áéíóöőúüű]/g, (char) => ACCENTS[char] ?? char)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

const slugField = z
  .string()
  .trim()
  .min(3, 'A link legalább 3 karakter legyen.')
  .max(60, 'A link legfeljebb 60 karakter lehet.')
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'A link csak kisbetűt, számot és kötőjelet tartalmazhat.')
  // Ütközés a saját útvonalainkkal.
  .refine(
    (value) => !['admin', 'api', 'bejelentkezes', 'foglalas', '_next'].includes(value),
    'Ez a link foglalt, válassz másikat.',
  )

export const createEventTypeSchema = z.object({
  title: z.string().trim().min(2, 'Adj meg egy nevet.').max(120, 'A név túl hosszú.'),
  slug: slugField,
  durationMin: z.coerce
    .number()
    .int('A hossz egész szám legyen.')
    .min(5, 'A hossz legalább 5 perc.')
    .max(600, 'A hossz legfeljebb 600 perc.'),
})

export const updateEventTypeSchema = z
  .object({
    title: z.string().trim().min(2, 'Adj meg egy nevet.').max(120, 'A név túl hosszú.'),
    slug: slugField,
    description: z.string().trim().max(2000, 'A leírás túl hosszú.').optional().default(''),
    locationNote: z.string().trim().max(300, 'A helyszín túl hosszú.').optional().default(''),
    durationMin: z.coerce.number().int().min(5, 'A hossz legalább 5 perc.').max(600),
    bufferBeforeMin: z.coerce.number().int().min(0).max(240, 'A puffer legfeljebb 240 perc.'),
    bufferAfterMin: z.coerce.number().int().min(0).max(240, 'A puffer legfeljebb 240 perc.'),
    minimumNoticeMin: z.coerce
      .number()
      .int()
      .min(0)
      .max(60 * 24 * 90),
    slotIntervalMin: z.coerce
      .number()
      .int()
      .min(5, 'A lépésköz legalább 5 perc.')
      .max(600)
      .nullable()
      .optional(),
    frequencyLimitCount: z.coerce
      .number()
      .int()
      .min(1, 'A korlát legalább 1 legyen.')
      .max(100)
      .nullable()
      .optional(),
    frequencyLimitPeriod: z.enum(['DAY', 'WEEK', 'MONTH']).nullable().optional(),
    reminderHoursBefore: z.coerce
      .number()
      .int()
      .min(1, 'Az emlékeztető legalább 1 órával előbb menjen ki.')
      .max(24 * 14)
      .nullable()
      .optional(),
    isActive: z.boolean(),
  })
  .refine((value) => (value.frequencyLimitCount == null) === (value.frequencyLimitPeriod == null), {
    message: 'A gyakorisági korláthoz a darabszám és az időszak is kell.',
    path: ['frequencyLimitCount'],
  })

export const availabilityWindowSchema = z
  .object({
    eventTypeId: z.string().min(1),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Érvénytelen dátum.'),
    startMin: z.coerce
      .number()
      .int()
      .min(0)
      .max(MINUTES_PER_DAY - 1),
    endMin: z.coerce.number().int().min(1).max(MINUTES_PER_DAY),
  })
  .refine((value) => value.endMin > value.startMin, {
    message: 'A sáv vége legyen későbbi a kezdeténél.',
    path: ['endMin'],
  })

export const createBookingSchema = z.object({
  eventTypeId: z.string().min(1),
  /** ISO 8601 pillanat — a kiválasztott időpont kezdete. */
  startsAt: z.string().datetime({ offset: true, message: 'Érvénytelen időpont.' }),
  guestName: z.string().trim().min(2, 'Add meg a neved.').max(120, 'A név túl hosszú.'),
  guestEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('Érvénytelen e-mail cím.')
    .max(200, 'Az e-mail cím túl hosszú.'),
  guestNote: z.string().trim().max(2000, 'A megjegyzés túl hosszú.').optional().default(''),
})

export const inviteCohostSchema = z.object({
  eventTypeId: z.string().min(1),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Érvénytelen e-mail cím.')
    .max(200, 'Az e-mail cím túl hosszú.'),
})

export type CreateEventTypeInput = z.infer<typeof createEventTypeSchema>
export type UpdateEventTypeInput = z.infer<typeof updateEventTypeSchema>
export type CreateBookingInput = z.infer<typeof createBookingSchema>
