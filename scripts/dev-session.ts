/**
 * Fejlesztői belépés Google OAuth nélkül: létrehoz egy adatbázis-munkamenetet
 * a megadott felhasználóhoz, és kiírja a sütit, amit a böngészőbe kell tenni.
 *
 *   pnpm tsx scripts/dev-session.ts [email]
 *
 * Csak helyi fejlesztéshez — éles környezetben a Google-belépést használd.
 */
import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { prisma } from '../src/lib/db'

async function main() {
  const email = process.argv[2] ?? 'demo@example.com'

  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    throw new Error(`Nincs ilyen felhasználó: ${email}. Futtasd előbb a seedet.`)
  }

  const sessionToken = randomBytes(32).toString('hex')

  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  console.log(sessionToken)
}

main()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
