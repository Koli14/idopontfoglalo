import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { auth, signIn } from '@/auth'
import { SubmitButton } from '@/components/form'

export const metadata: Metadata = { title: 'Belépés' }

const ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    'Ehhez az e-mail címhez már tartozik fiók egy másik belépési móddal. Használd az eredeti belépési módot.',
  AccessDenied: 'A belépés megszakadt, vagy nem engedélyezted a hozzáférést.',
  Configuration:
    'A Google-belépés nincs beállítva. Ellenőrizd az AUTH_GOOGLE_ID és AUTH_GOOGLE_SECRET értékeket.',
}

export default async function SignInPage({ searchParams }: PageProps<'/bejelentkezes'>) {
  const session = await auth()

  if (session?.user) {
    redirect('/admin')
  }

  const params = await searchParams
  const errorCode = typeof params.error === 'string' ? params.error : null
  const errorMessage = errorCode
    ? (ERROR_MESSAGES[errorCode] ?? 'A belépés nem sikerült. Próbáld újra.')
    : null

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <div className="card p-8">
        <h1 className="text-xl font-semibold">Belépés</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Lépj be a Google-fiókoddal az időpontjaid kezeléséhez. Ha társszervezőnek hívtak meg,
          ugyanazzal az e-mail címmel lépj be, amelyre a meghívót kaptad.
        </p>

        {errorMessage ? (
          <p className="mt-5 alert-error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <form
          className="mt-6"
          action={async () => {
            'use server'
            await signIn('google', { redirectTo: '/admin' })
          }}
        >
          <SubmitButton className="w-full" pendingLabel="Átirányítás…">
            Belépés Google-fiókkal
          </SubmitButton>
        </form>
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/" className="hover:text-ink">
          Vissza a főoldalra
        </Link>
      </p>
    </main>
  )
}
