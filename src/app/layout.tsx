import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

// A latin-ext alkészlet nélkül hiányoznának a magyar ő és ű betűk.
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'latin-ext'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin', 'latin-ext'],
})

export const metadata: Metadata = {
  title: {
    default: 'Időpontfoglaló',
    template: '%s — Időpontfoglaló',
  },
  description: 'Oszd meg a szabad időpontjaidat, és foglaljanak belőlük egy kattintással.',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="hu" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-canvas text-ink">{children}</body>
    </html>
  )
}
