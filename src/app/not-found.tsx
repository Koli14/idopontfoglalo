import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16 text-center">
      <p className="text-sm font-semibold text-accent">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Ez az oldal nem található</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Lehet, hogy a foglalási link elavult, vagy a szervező törölte az eseményt. Kérd el a friss
        linket a szervezőtől.
      </p>
      <p className="mt-6">
        <Link href="/" className="btn-secondary">
          Vissza a főoldalra
        </Link>
      </p>
    </main>
  )
}
