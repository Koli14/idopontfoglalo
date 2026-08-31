import Link from 'next/link'
import { auth, signOut } from '@/auth'
import { requireUser } from '@/lib/auth-guards'
import { SubmitButton } from '@/components/form'

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  await requireUser()
  const session = await auth()

  return (
    <>
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/admin" className="text-sm font-semibold tracking-tight">
            Időpontfoglaló
          </Link>

          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-muted sm:inline">
              {session?.user?.name ?? session?.user?.email}
            </span>
            <form
              action={async () => {
                'use server'
                await signOut({ redirectTo: '/' })
              }}
            >
              <SubmitButton variant="secondary" pendingLabel="Kilépés…">
                Kilépés
              </SubmitButton>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</div>
    </>
  )
}
