import { Resend } from 'resend'

export type MailAttachment = {
  filename: string
  content: string
}

export type MailInput = {
  to: string | string[]
  subject: string
  html: string
  text: string
  replyTo?: string
  attachments?: MailAttachment[]
}

const FROM = process.env.EMAIL_FROM ?? 'Időpontfoglaló <onboarding@resend.dev>'

let client: Resend | null = null

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY

  if (!apiKey) return null
  if (!client) client = new Resend(apiKey)

  return client
}

/**
 * E-mail küldése Resenden keresztül.
 *
 * RESEND_API_KEY nélkül nem küld semmit, csak naplóz — így a fejlesztői
 * környezet és a tesztek külső szolgáltatás nélkül is működnek.
 *
 * A küldés hibája sosem buktatja el a hívót: egy foglalás attól még érvényes,
 * hogy a visszaigazoló levél nem ment ki.
 */
export async function sendMail(input: MailInput): Promise<{ sent: boolean; error?: string }> {
  const recipients = Array.isArray(input.to) ? input.to : [input.to]
  const to = recipients.filter((address) => address.length > 0)

  if (to.length === 0) return { sent: false, error: 'Nincs címzett.' }

  const resend = getClient()

  if (!resend) {
    console.info(
      `[email] RESEND_API_KEY nincs beállítva — a levél nem ment ki.\n` +
        `  Címzett: ${to.join(', ')}\n` +
        `  Tárgy:   ${input.subject}\n` +
        `${input.text.replace(/^/gm, '  | ')}`,
    )
    return { sent: false }
  }

  try {
    const result = await resend.emails.send({
      from: FROM,
      to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo,
      attachments: input.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: Buffer.from(attachment.content, 'utf-8').toString('base64'),
      })),
    })

    if (result.error) {
      console.error('[email] Sikertelen küldés:', result.error)
      return { sent: false, error: result.error.message }
    }

    return { sent: true }
  } catch (error) {
    console.error('[email] Sikertelen küldés:', error)
    return { sent: false, error: error instanceof Error ? error.message : 'Ismeretlen hiba' }
  }
}
