import { formatDateTimeRange, formatDuration } from '@/lib/time'

export type BookingEmailData = {
  eventTitle: string
  hostName: string
  guestName: string
  guestEmail: string
  guestNote?: string | null
  locationNote?: string | null
  startsAt: Date
  endsAt: Date
  durationMin: number
  timezone: string
  /** A vendég kezelőoldala (lemondás, naptárba mentés). */
  manageUrl: string
}

export type RenderedEmail = {
  subject: string
  html: string
  text: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

type LayoutInput = {
  heading: string
  intro: string
  rows: [string, string][]
  note?: string | null
  button?: { label: string; url: string }
  footer?: string
}

function layout(input: LayoutInput): { html: string; text: string } {
  const rowsHtml = input.rows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:6px 16px 6px 0;color:#64748b;font-size:14px;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td>
          <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join('')

  const noteHtml = input.note
    ? `<div style="margin:20px 0 0;padding:12px 16px;background:#f8fafc;border-left:3px solid #cbd5e1;border-radius:4px">
         <div style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">Megjegyzés</div>
         <div style="color:#0f172a;font-size:14px;white-space:pre-wrap">${escapeHtml(input.note)}</div>
       </div>`
    : ''

  const buttonHtml = input.button
    ? `<div style="margin:28px 0 0">
         <a href="${escapeHtml(input.button.url)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:11px 20px;border-radius:8px;font-size:14px;font-weight:600">${escapeHtml(input.button.label)}</a>
       </div>`
    : ''

  const footerHtml = input.footer
    ? `<p style="margin:28px 0 0;color:#94a3b8;font-size:12px;line-height:1.6">${escapeHtml(input.footer)}</p>`
    : ''

  const html = `<!doctype html>
<html lang="hu">
  <body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e2e8f0">
      <h1 style="margin:0 0 8px;font-size:20px;line-height:1.3;color:#0f172a">${escapeHtml(input.heading)}</h1>
      <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6">${escapeHtml(input.intro)}</p>
      <table style="border-collapse:collapse;width:100%">${rowsHtml}</table>
      ${noteHtml}
      ${buttonHtml}
      ${footerHtml}
    </div>
  </body>
</html>`

  const text = [
    input.heading,
    '',
    input.intro,
    '',
    ...input.rows.map(([label, value]) => `${label}: ${value}`),
    ...(input.note ? ['', `Megjegyzés: ${input.note}`] : []),
    ...(input.button ? ['', `${input.button.label}: ${input.button.url}`] : []),
    ...(input.footer ? ['', input.footer] : []),
  ].join('\n')

  return { html, text }
}

function bookingRows(data: BookingEmailData): [string, string][] {
  const rows: [string, string][] = [
    ['Esemény', data.eventTitle],
    ['Időpont', formatDateTimeRange(data.startsAt, data.endsAt, data.timezone)],
    ['Hossz', formatDuration(data.durationMin)],
  ]

  if (data.locationNote) rows.push(['Helyszín', data.locationNote])

  return rows
}

export function bookingConfirmedGuest(data: BookingEmailData): RenderedEmail {
  const { html, text } = layout({
    heading: 'Foglalásod megerősítve',
    intro: `Kedves ${data.guestName}! Lefoglaltuk az időpontodat ${data.hostName} naptárában.`,
    rows: [...bookingRows(data), ['Szervező', data.hostName]],
    note: data.guestNote,
    button: { label: 'Foglalás megtekintése', url: data.manageUrl },
    footer:
      'Ha mégsem tudsz jönni, a fenti linken bármikor lemondhatod az időpontot. ' +
      'Az időpontok közép-európai idő szerint értendők.',
  })

  return {
    subject: `Foglalás megerősítve — ${data.eventTitle}`,
    html,
    text,
  }
}

export function bookingConfirmedHost(data: BookingEmailData): RenderedEmail {
  const { html, text } = layout({
    heading: 'Új foglalás érkezett',
    intro: `${data.guestName} lefoglalt egy időpontot: ${data.eventTitle}.`,
    rows: [...bookingRows(data), ['Vendég', data.guestName], ['E-mail', data.guestEmail]],
    note: data.guestNote,
    button: { label: 'Foglalás megtekintése', url: data.manageUrl },
  })

  return {
    subject: `Új foglalás: ${data.eventTitle} — ${data.guestName}`,
    html,
    text,
  }
}

export function bookingReminder(data: BookingEmailData): RenderedEmail {
  const { html, text } = layout({
    heading: 'Emlékeztető a közelgő időpontodról',
    intro: `Kedves ${data.guestName}! Emlékeztetünk a közelgő időpontodra ${data.hostName} naptárában.`,
    rows: bookingRows(data),
    note: data.guestNote,
    button: { label: 'Foglalás megtekintése', url: data.manageUrl },
    footer: 'Ha mégsem tudsz jönni, kérjük, a fenti linken mondd le az időpontot.',
  })

  return {
    subject: `Emlékeztető: ${data.eventTitle}`,
    html,
    text,
  }
}

export function bookingCancelled(
  data: BookingEmailData & {
    cancelledBy: 'GUEST' | 'HOST'
    audience: 'GUEST' | 'HOST'
    reason?: string | null
  },
): RenderedEmail {
  const intro =
    data.audience === 'GUEST'
      ? data.cancelledBy === 'HOST'
        ? `Kedves ${data.guestName}! A szervező lemondta az alábbi időpontot.`
        : `Kedves ${data.guestName}! Visszaigazoljuk, hogy lemondtad az alábbi időpontot.`
      : data.cancelledBy === 'GUEST'
        ? `${data.guestName} lemondta az alábbi időpontot. A felszabadult idősáv újra foglalható.`
        : `Az alábbi időpont lemondásra került. A felszabadult idősáv újra foglalható.`

  const rows: [string, string][] = [...bookingRows(data)]

  if (data.audience === 'HOST') {
    rows.push(['Vendég', data.guestName], ['E-mail', data.guestEmail])
  }

  const { html, text } = layout({
    heading: 'Az időpont lemondva',
    intro,
    rows,
    note: data.reason ? data.reason : null,
  })

  return {
    subject: `Lemondva: ${data.eventTitle}`,
    html,
    text,
  }
}

export function cohostInvite(input: {
  eventTitle: string
  inviterName: string
  adminUrl: string
}): RenderedEmail {
  const { html, text } = layout({
    heading: 'Meghívtak társszervezőnek',
    intro: `${input.inviterName} felkért, hogy társszervezőként kezeld a(z) "${input.eventTitle}" esemény időpontjait.`,
    rows: [
      ['Esemény', input.eventTitle],
      ['Meghívó', input.inviterName],
    ],
    button: { label: 'Belépés', url: input.adminUrl },
    footer:
      'Jelentkezz be Google-fiókkal ugyanezzel az e-mail címmel — a meghívó a belépéskor ' +
      'automatikusan aktiválódik. Társszervezőként szerkesztheted az elérhetőségi sávokat ' +
      'és kezelheted a foglalásokat.',
  })

  return {
    subject: `Társszervezői meghívó — ${input.eventTitle}`,
    html,
    text,
  }
}
