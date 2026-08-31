'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TABS = [
  { segment: '', label: 'Beállítások' },
  { segment: '/elerhetoseg', label: 'Elérhetőség' },
  { segment: '/foglalasok', label: 'Foglalások' },
  { segment: '/csapat', label: 'Csapat' },
]

export function EventTabs({ eventTypeId }: { eventTypeId: string }) {
  const pathname = usePathname()
  const base = `/admin/esemeny/${eventTypeId}`

  return (
    <nav className="flex gap-1 border-b border-line" aria-label="Esemény szakaszai">
      {TABS.map((tab) => {
        const href = `${base}${tab.segment}`
        const active = pathname === href

        return (
          <Link
            key={tab.segment}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              active
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:border-line-strong hover:text-ink'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
