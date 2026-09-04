import { prisma } from '@/lib/db'

/**
 * Összeköti a felhasználót a rá váró társszervezői meghívókkal.
 *
 * A meghívó e-mail címre szól; a Google által visszaadott cím igazolt, ezért a
 * párosítás biztonságos. Bejelentkezéskor hívjuk (lásd `src/auth.ts`).
 *
 * @returns hány meghívó aktiválódott
 */
export async function linkPendingInvites(userId: string, email: string): Promise<number> {
  const result = await prisma.eventTypeMember.updateMany({
    where: { invitedEmail: email.toLowerCase(), userId: null },
    data: { userId, acceptedAt: new Date() },
  })

  return result.count
}
