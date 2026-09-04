import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Ez a fájl csak a Prisma CLI-t konfigurálja (migrate, generate, studio).
// A futó alkalmazás a `src/lib/db.ts`-ben, driver adapteren keresztül
// csatlakozik a DATABASE_URL-lel.
//
// A migrációk DIRECT_URL-t használnak: a Neon pooled (pgbouncer) végpontja
// nem alkalmas DDL futtatására.
const url = process.env['DIRECT_URL'] ?? process.env['DATABASE_URL']

// A `generate` nem igényel adatbázist — a `postinstall` így beállított
// kapcsolat nélkül is lefut. Csak akkor állunk meg, ha a parancsnak tényleg
// kell adatbázis; enélkül a Prisma csak annyit mondana, hogy "datasource.url
// is required", és nem derülne ki, melyik változó hiányzik.
const needsDatabase = process.argv.some((arg) => ['migrate', 'db', 'studio', 'debug'].includes(arg))

if (!url && needsDatabase) {
  throw new Error(
    'Hiányzik a DIRECT_URL (vagy DATABASE_URL) környezeti változó, ' +
      'pedig ehhez a Prisma parancshoz adatbázis-kapcsolat kell.\n' +
      'Helyben: másold a .env.example fájlt .env néven és töltsd ki.\n' +
      'Vercelen: Project Settings → Environment Variables. Neon esetén a ' +
      'DIRECT_URL a nem pooled (unpooled/direct) connection string legyen — ' +
      'a pooled végponton nem futtatható migráció.',
  )
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url,
  },
})
