import { transporter } from '../config/mailer.js'
import { env } from '../config/env.js'
import type { RenderPage } from '@menu-bar/shared'
import { renderMenu } from '../render/renderMenu.js'

interface Attachment {
  filename: string
  content: Buffer
  contentType: string
}

export async function sendMenuEmail(params: {
  to: string
  subject: string
  templateName: string
  pages: RenderPage[]
}): Promise<void> {
  const attachments: Attachment[] = []

  for (let i = 0; i < params.pages.length; i++) {
    const page = params.pages[i]
    if (!page) continue

    const buf = await renderMenu({ ...page, output_format: 'jpg' })
    attachments.push({
      filename: `menu-${String(i + 1).padStart(2, '0')}.jpg`,
      content: buf,
      contentType: 'image/jpeg',
    })
  }

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: params.to,
    subject: params.subject || 'Menú',
    html: `<p>Adjunto encontrarás el menú: <strong>${params.templateName}</strong></p>`,
    attachments,
  })
}
