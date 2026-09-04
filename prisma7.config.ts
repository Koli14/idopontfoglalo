import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Ez a fájl csak a Prisma CLI-t konfigurálja (migrate, generate, studio).
// A futó alkalmazás a `src/lib/db.ts`-ben, driver adapteren keresztül
// csatlakozik a DATABASE_URL-lel.
//
// A migrációk DIRECT_URL-t használnak: a Neon pooled (pgbouncer) végpontja
// nem alkalmas DDL futtatására.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'],
  },
})
