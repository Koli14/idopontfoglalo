'use client'

import { useEffect, useState } from 'react'

/** Vágólapra másolja a foglalási linket, és rövid visszajelzést ad. */
export function CopyLinkButton({ url, label = 'Link másolása' }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return

    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url)
          setCopied(true)
        } catch {
          // A vágólap letiltható; ilyenkor a link amúgy is olvasható az oldalon.
          setCopied(false)
        }
      }}
    >
      {copied ? 'Másolva' : label}
    </button>
  )
}
