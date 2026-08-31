/**
 * Minimális iCalendar (RFC 5545) előállítás a foglalások naptárba mentéséhez.
 * Az időpontokat UTC-ben írjuk ki, így nincs szükség VTIMEZONE blokkra.
 */

export type IcsEvent = {
  uid: string
  startsAt: Date
  endsAt: Date
  summary: string
  description?: string
  location?: string
  organizerName?: string
  organizerEmail?: string
  cancelled?: boolean
  /** Növekvő verziószám: lemondáskor a naptárak ez alapján frissítenek. */
  sequence?: number
}

function formatUtc(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`
}

/** RFC 5545 szerinti escape-elés a szöveges mezőkben. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * A sorok legfeljebb 75 oktettesek lehetnek; a folytatás egy szóközzel kezdődik.
 * Oktettben számolunk, mert az ékezetes karakterek UTF-8-ban többájtosak.
 */
function foldLine(line: string): string {
  const encoder = new TextEncoder()

  if (encoder.encode(line).length <= 75) return line

  const chunks: string[] = []
  let current = ''
  let currentBytes = 0
  // Az első sor 75, a folytatások 74 oktettet vihetnek (a vezető szóköz miatt).
  let limit = 75

  for (const char of line) {
    const size = encoder.encode(char).length

    if (currentBytes + size > limit) {
      chunks.push(current)
      current = ''
      currentBytes = 0
      limit = 74
    }

    current += char
    currentBytes += size
  }

  if (current) chunks.push(current)

  return chunks.join('\r\n ')
}

export function buildIcs(event: IcsEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Idopontfoglalo//HU',
    'CALSCALE:GREGORIAN',
    `METHOD:${event.cancelled ? 'CANCEL' : 'PUBLISH'}`,
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${formatUtc(new Date())}`,
    `DTSTART:${formatUtc(event.startsAt)}`,
    `DTEND:${formatUtc(event.endsAt)}`,
    `SUMMARY:${escapeText(event.summary)}`,
    `SEQUENCE:${event.sequence ?? 0}`,
    `STATUS:${event.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
  ]

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`)
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`)
  }

  if (event.organizerEmail) {
    const name = event.organizerName ? `;CN=${escapeText(event.organizerName)}` : ''
    lines.push(`ORGANIZER${name}:mailto:${event.organizerEmail}`)
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')

  return lines.map(foldLine).join('\r\n')
}
