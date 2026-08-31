import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { prisma } from '@/lib/db'

export class AccessDeniedError extends Error {
  constructor(message = 'Nincs jogosultságod ehhez a művelethez.') {
    super(message)
    this.name = 'AccessDeniedError'
  }
}

/** Bejelentkezett felhasználó, vagy átirányítás a bejelentkezésre. */
export async function requireUser() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect('/bejelentkezes')
  }

  return session.user
}

export type EventAccess = {
  userId: string
  isOwner: boolean
}

/**
 * Ellenőrzi, hogy a bejelentkezett felhasználó szerkesztheti-e az
 * eseménytípust. Tulajdonos és elfogadott meghívóval rendelkező társszervező
 * fér hozzá; a tulajdonosi jogokat (törlés, csapatkezelés) az `isOwner` jelzi.
 *
 * Minden admin oldal és szerveroldali művelet ezen keresztül ellenőriz, hogy
 * egyetlen helyen legyen a jogosultsági szabály.
 */
export async function requireEventAccess(eventTypeId: string): Promise<EventAccess> {
  const user = await requireUser()

  const eventType = await prisma.eventType.findUnique({
    where: { id: eventTypeId },
    select: {
      ownerId: true,
      members: {
        where: { userId: user.id, acceptedAt: { not: null } },
        select: { id: true },
      },
    },
  })

  if (!eventType) {
    throw new AccessDeniedError('A keresett esemény nem található.')
  }

  const isOwner = eventType.ownerId === user.id

  if (!isOwner && eventType.members.length === 0) {
    throw new AccessDeniedError()
  }

  return { userId: user.id, isOwner }
}

/** Csak a tulajdonos: törlés és a társszervezők kezelése. */
export async function requireEventOwner(eventTypeId: string): Promise<EventAccess> {
  const access = await requireEventAccess(eventTypeId)

  if (!access.isOwner) {
    throw new AccessDeniedError('Ehhez a művelethez tulajdonosi jogosultság szükséges.')
  }

  return access
}

/** Az összes eseménytípus, amit a felhasználó szerkeszthet. */
export function eventTypesVisibleTo(userId: string) {
  return {
    OR: [{ ownerId: userId }, { members: { some: { userId, acceptedAt: { not: null } } } }],
  }
}
