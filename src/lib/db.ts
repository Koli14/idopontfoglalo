import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

// Serverless környezetben a modul újratöltődhet, ezért a klienst globálisan
// tároljuk — különben fejlesztés közben elfogynának a DB kapcsolatok.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

function createClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error('Hiányzik a DATABASE_URL környezeti változó.')
  }

  const adapter = new PrismaPg({ connectionString })

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
