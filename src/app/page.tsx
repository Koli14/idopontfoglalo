import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/auth'

const FEATURES = [
  {
    title: 'Dátumra szabott sávok',
    body: 'Nem heti sablon: minden naphoz külön adod meg, mikor érsz rá. A megadott sávokat az alkalmazás automatikusan felszeleteli a megbeszélés hosszára.',
  },
  {
    title: 'Társszervezők',
    body: 'Hívj meg kollégát, aki ugyanúgy szerkesztheti az elérhetőséget és láthatja a foglalásokat. A meghívó a Google-belépéskor aktiválódik.',
  },
  {
    title: 'Nincs dupla foglalás',
    body: 'Amint valaki lefoglal egy időpontot, az azonnal eltűnik mindenki más listájából. Az adatbázis is kizárja, hogy két foglalás ütközzön.',
  },
  {
    title: 'Pufferek és korlátok',
    body: 'Állíts be szünetet a megbeszélések közé, minimális előfoglalási időt, és napi, heti vagy havi foglalási korlátot.',
  },
]

export default async function HomePage() {
  const session = await auth()

  if (session?.user) {
    redirect('/admin')
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-20">
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">Időpontfoglaló</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
        Oszd meg a szabad időpontjaidat, a többit intézzük.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
        Add meg, mely napokon és mikor érsz rá, oszd meg a linket — a vendégeid pedig kiválasztják a
        nekik megfelelő időpontot. Egy sávot csak egyszer lehet lefoglalni.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href="/bejelentkezes" className="btn-primary">
          Belépés Google-fiókkal
        </Link>
      </div>

      <dl className="mt-16 grid gap-5 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <div key={feature.title} className="card p-5">
            <dt className="text-sm font-semibold text-ink">{feature.title}</dt>
            <dd className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</dd>
          </div>
        ))}
      </dl>
    </main>
  )
}
