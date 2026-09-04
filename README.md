# Időpontfoglaló

Időpontfoglaló alkalmazás: a szervező dátumhoz kötött elérhetőségi sávokat ad
meg, megosztja a foglalási linket, a vendégek pedig kiválasztják a nekik
megfelelő szabad időpontot. Egy időpontot csak egyszer lehet lefoglalni.

- **Társszervezők** — e-mailes meghívóval bárki bevonható, aki ugyanúgy
  szerkesztheti az elérhetőséget és kezelheti a foglalásokat.
- **zcal-stílusú beállítások** — foglalási gyakoriság korlátozása, minimális
  előfoglalási idő, szünet az esemény előtt és után, emlékeztető e-mail.
- **Dupla foglalás kizárva** — adatbázis-szintű garanciával (lásd lentebb).

Nyelv: magyar. Időzóna: `Europe/Budapest` (eseményenként állítható a
`EventType.timezone` mezőben).

## Technológia

| Réteg         | Választás                                                  |
| ------------- | ---------------------------------------------------------- |
| Keretrendszer | Next.js 16 (App Router, Server Components, Server Actions) |
| Nyelv         | TypeScript (strict)                                        |
| Stílus        | Tailwind CSS v4                                            |
| Adatbázis     | PostgreSQL + Prisma 7 (`@prisma/adapter-pg`)               |
| Belépés       | Auth.js v5 (NextAuth), Google OAuth, adatbázis-munkamenet  |
| E-mail        | Resend                                                     |
| Ütemezés      | Vercel Cron                                                |
| Teszt         | Vitest                                                     |

## Indulás helyben

```bash
pnpm install

# Helyi Postgres Dockerben
docker run -d --name idopontfoglalo-db \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=idopontfoglalo -p 55432:5432 postgres:17-alpine

cp .env.example .env      # töltsd ki (a DATABASE_URL a fentihez már jó)
pnpm prisma migrate dev   # séma létrehozása
pnpm db:seed              # demo esemény: /konzultacio
pnpm dev
```

A foglalóoldal ezután elérhető: <http://localhost:3000/konzultacio>

### Belépés fejlesztés közben

A `/admin` felülethez Google-belépés kell. Ha nem akarsz OAuth-t beállítani,
készíts munkamenetet a seedelt felhasználóhoz:

```bash
pnpm tsx scripts/dev-session.ts demo@example.com
```

A kiírt értéket tedd be `authjs.session-token` néven sütiként a
`localhost` domainre.

### Google OAuth beállítása

Google Cloud Console → _APIs & Services_ → _Credentials_ → _OAuth client ID_
(Web application). Engedélyezett redirect URI:

```
http://localhost:3000/api/auth/callback/google      # fejlesztés
https://<a-te-domained>/api/auth/callback/google    # éles
```

A kapott azonosítókat írd a `.env` `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
mezőibe.

### E-mail

`RESEND_API_KEY` nélkül a levelek nem mennek ki, hanem a szerver konzoljára
íródnak — így a teljes folyamat végigpróbálható külső szolgáltatás nélkül.

## Parancsok

| Parancs                         | Mit csinál                                                      |
| ------------------------------- | --------------------------------------------------------------- |
| `pnpm dev`                      | Fejlesztői szerver                                              |
| `pnpm build`                    | Prisma Client generálás + produkciós build (típusellenőrzéssel) |
| `pnpm test`                     | Az időpontgeneráló egységtesztjei                               |
| `pnpm db:migrate`               | Migráció készítése és futtatása                                 |
| `pnpm db:deploy`                | Migrációk alkalmazása (éles)                                    |
| `pnpm db:seed`                  | Demo adatok                                                     |
| `pnpm db:studio`                | Prisma Studio                                                   |
| `pnpm tsx scripts/race-test.ts` | Versenyhelyzet- és limitellenőrzés éles adatbázison             |

## Hogyan működik

### Időpontok előállítása

Az elérhetőség **dátumhoz kötött sávokban** tárolódik (`AvailabilityWindow`:
naptári nap + helyi éjféltől számított kezdő és záró perc). Ebből a
`src/lib/slots.ts` `generateSlots()` függvénye állítja elő a foglalható
időpontokat:

1. A sávot abszolút UTC pillanatokra oldjuk fel az esemény időzónája szerint.
2. Lépésköz szerint haladunk (alapból `hossz + szünet előtte + szünet utána`,
   vagy a kézzel megadott `slotIntervalMin`), és csak akkor adunk ki időpontot,
   ha a teljes találkozó belefér a sávba.
3. Kiesnek a múltbeli és a minimális előfoglalási időn belüli időpontok.
4. Kiesnek azok, amelyek lefoglalt idővel ütköznek — a pufferekkel együtt: egy
   megbeszélés a `[kezdés − szünet előtte, vég + szünet utána)` sávot foglalja
   el, és két ilyen sáv nem fedheti át egymást.
5. Kiesnek azok, amelyeknél az adott napra/hétre/hónapra megengedett
   foglalásszám már betelt.

> **Példa.** 45 perces esemény, 15 perc utólagos szünettel, 09:00–12:00 sávval
> → 09:00, 10:00 és 11:00 időpontokat ad.

Ugyanez a függvény fut a nyilvános foglalóoldalon, a szerkesztői előnézetben és
a foglalás mentésekor is, így a három nem tud eltérni egymástól.

**Nyári időszámítás.** A sávok helyi _fali óra_ szerint tárolódnak, ezért a
09:00 mindig 09:00 marad az óraátállítás mindkét oldalán. A generálás abszolút
pillanatokkal számol, így a 23 és 25 órás napok is helyesen jönnek ki — erre
külön tesztek vannak (`src/lib/slots.test.ts`).

### Dupla foglalás elleni védelem

Két, egymástól független réteg (`src/lib/booking.ts`):

1. **Tanácsadói zár.** A foglalási tranzakció elején
   `pg_advisory_xact_lock(hashtext(eventTypeId))` fut, ami eseményenként
   sorosítja a foglalásokat. Így az ellenőrzés és a beszúrás közé nem tud
   beékelődni egy másik foglalás — ez fedi le a pufferek miatti ütközést is,
   amit egy egyedi index nem tudna kifejezni.
2. **Egyedi index.** A `Booking(eventTypeId, activeAt)` páros egyedi. Az
   `activeAt` érvényes foglalásnál megegyezik a kezdés időpontjával,
   lemondáskor `NULL` lesz — Postgresben a NULL értékek nem ütköznek egyedi
   indexben, ezért a lemondott időpont azonnal újra foglalható.

A `scripts/race-test.ts` nyolc egyidejű foglalást indít ugyanarra az időpontra,
és ellenőrzi, hogy pontosan egy sikerül.

### Jogosultságok

Minden admin oldal és művelet a `src/lib/auth-guards.ts` két függvényén
keresztül ellenőriz:

- `requireEventAccess()` — tulajdonos **vagy** elfogadott meghívóval rendelkező
  társszervező: beállítások, elérhetőség, foglalások.
- `requireEventOwner()` — csak tulajdonos: esemény törlése, csapat kezelése.

A meghívó e-mail címre szól. Belépéskor a `linkPendingInvites()`
(`src/lib/invites.ts`) köti össze a fiókkal — a Google által visszaadott cím
igazolt, ezért a párosítás biztonságos.

## Telepítés Vercelre

1. **Adatbázis.** A Vercel projektben _Storage_ → _Neon_ (vagy bármely
   Postgres). A `DATABASE_URL` legyen a **pooled**, a `DIRECT_URL` a
   **direct** connection string — a migrációk nem futtathatók a pgbouncer
   végponton.
2. **Környezeti változók** (Project Settings → Environment Variables): a
   `.env.example` összes kulcsa. A `NEXT_PUBLIC_APP_URL` az éles domain legyen,
   mert a foglalási linkek és a levelek ebből épülnek.
3. **Migrációk.** A `vercel.json` `buildCommand` mezője már tartalmazza a
   `prisma migrate deploy` lépést, tehát minden telepítés alkalmazza a még
   nem futtatott migrációkat. Ehhez a `DIRECT_URL`-nek elérhetőnek kell lennie
   a build alatt.
4. **Google OAuth.** Vedd fel az éles redirect URI-t (lásd fentebb).
5. **Cron.** A `vercel.json` naponta egyszer (06:00 UTC) hívja a
   `/api/cron/emlekeztetok` végpontot — a Vercel **Hobby csomagja csak napi
   ütemezést enged**. A `CRON_SECRET` beállításakor a Vercel automatikusan
   küldi az `Authorization: Bearer` fejlécet; enélkül a végpont bárki által
   hívható, ezért éles környezetben mindig állítsd be.

   A végpont minden emlékeztetőt kiküld, ami a _következő futásig_ esedékessé
   válik — különben a ritka futás egyszerűen átugraná a rövid előretartású
   emlékeztetőket. Emiatt egy emlékeztető legfeljebb egy futási közzel korábban
   érkezhet a beállított időpontnál. Ha Pro csomagra váltasz és sűrűbb
   ütemezést állítasz be, add meg a `CRON_INTERVAL_HOURS` változót is (pl. `1`
   óránkénti futásnál), hogy az előretartás ehhez igazodjon.

## Könyvtárszerkezet

```
prisma/schema.prisma          adatmodell
src/lib/slots.ts              időpontgenerálás (a rendszer magja)
src/lib/booking.ts            foglalás és lemondás, versenyhelyzet-védelemmel
src/lib/time.ts               időzóna- és formázási segédfüggvények
src/lib/auth-guards.ts        jogosultság-ellenőrzés
src/lib/notifications.ts      e-mail értesítések összeállítása
src/app/[slug]/               nyilvános foglalóoldal
src/app/foglalas/[token]/     vendég visszaigazoló és lemondó oldala
src/app/admin/                szervezői felület
src/app/api/cron/             emlékeztetők ütemezett kiküldése
```

## Ismert korlátok

- A foglalóoldal az esemény időzónájában mutatja az időpontokat; nincs
  vendégoldali időzóna-váltó.
- Nincs naptárszinkron (Google/Outlook) — a foglalások `.ics` fájlként
  menthetők.
- A nyilvános foglalási végpontnak nincs sebességkorlátja; nyilvános
  üzemeltetés előtt érdemes hozzátenni.

Hó!
