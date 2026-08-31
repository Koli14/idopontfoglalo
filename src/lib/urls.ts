/**
 * Az alkalmazás nyilvános alapcíme. A levelekben és a megosztható
 * foglalási linkekben abszolút URL kell, ezért nem elég a relatív útvonal.
 */
export function appUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL

  if (configured) return configured.replace(/\/$/, '')

  // Vercelen a production domain, előnézeti telepítésnél a deployment URL.
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL

  if (vercelHost) return `https://${vercelHost}`

  return 'http://localhost:3000'
}

export function bookingPageUrl(slug: string): string {
  return `${appUrl()}/${slug}`
}

export function manageBookingUrl(manageToken: string): string {
  return `${appUrl()}/foglalas/${manageToken}`
}

export function adminUrl(path = ''): string {
  return `${appUrl()}/admin${path}`
}
