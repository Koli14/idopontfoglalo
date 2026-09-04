import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { prisma } from '@/lib/db'
import { requireEventAccess } from '@/lib/auth-guards'
import { appUrl } from '@/lib/urls'
import { SettingsForm } from '@/app/admin/esemeny/[id]/settings-form'
import { DeleteEventSection } from '@/app/admin/esemeny/[id]/delete-event-section'

export const metadata: Metadata = { title: 'Beállítások' }

export default async function EventSettingsPage({ params }: PageProps<'/admin/esemeny/[id]'>) {
  const { id } = await params
  const { isOwner } = await requireEventAccess(id)

  const eventType = await prisma.eventType.findUnique({ where: { id } })

  if (!eventType) notFound()

  return (
    <div className="space-y-6">
      <SettingsForm eventType={eventType} appHost={appUrl().replace(/^https?:\/\//, '')} />

      {isOwner ? (
        <DeleteEventSection eventTypeId={eventType.id} title={eventType.title} />
      ) : (
        <p className="hint">
          Társszervezőként szerkesztheted a beállításokat és az elérhetőséget, de az esemény törlése
          és a csapat kezelése a tulajdonos joga.
        </p>
      )}
    </div>
  )
}
