import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { lte, eq, and, or, isNull } from 'drizzle-orm'
import type { Logger } from 'pino'
import { db } from '../db/index.js'
import { scheduledEmails, scheduledPosts } from '../db/schema.js'
import { sendMenuEmail } from './email.service.js'
import { publishStory } from './instagram.service.js'
import { renderMenu } from '../render/renderMenu.js'
import { env } from '../config/env.js'
import type { RenderPage } from '@menu-bar/shared'

const TEMP_DIR = path.join(
  path.resolve(process.env['STORAGE_DIR'] ?? path.join(process.cwd(), 'storage')),
  'temp',
)

const MAX_RETRIES = 3
const INTERVAL_MS = 60_000

let emailInterval: ReturnType<typeof setInterval> | null = null
let igInterval: ReturnType<typeof setInterval> | null = null
let log: Logger

function retryDelay(retryCount: number): Date {
  // Backoff exponencial: 2^n minutos (1min, 2min, 4min)
  const delayMs = Math.min(Math.pow(2, retryCount) * 60_000, 4 * 60_000)
  return new Date(Date.now() + delayMs)
}

// ===== EMAIL SCHEDULER =====
async function processScheduledEmails() {
  const now = new Date()

  const pending = await db.query.scheduledEmails.findMany({
    where: and(
      eq(scheduledEmails.status, 'pending'),
      lte(scheduledEmails.sendAt, now),
      or(isNull(scheduledEmails.nextRetryAt), lte(scheduledEmails.nextRetryAt, now)),
    ),
  })

  for (const row of pending) {
    try {
      const pages = JSON.parse(row.renderConfig) as RenderPage[]
      const pageArray = Array.isArray(pages) ? pages : [pages]

      await sendMenuEmail({
        to: row.emailTo,
        subject: row.subject ?? 'Menú',
        templateName: row.templateName ?? '',
        pages: pageArray,
      })

      await db
        .update(scheduledEmails)
        .set({ status: 'sent' })
        .where(eq(scheduledEmails.id, row.id))

      log.info({ id: row.id, to: row.emailTo }, '✉ Email programado enviado')
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      const newRetryCount = row.retryCount + 1

      if (newRetryCount >= MAX_RETRIES) {
        await db
          .update(scheduledEmails)
          .set({ status: 'failed', errorMsg: error.message })
          .where(eq(scheduledEmails.id, row.id))
        log.error({ id: row.id, err: error }, '❌ Email fallido definitivamente')
      } else {
        await db
          .update(scheduledEmails)
          .set({ retryCount: newRetryCount, nextRetryAt: retryDelay(newRetryCount), errorMsg: error.message })
          .where(eq(scheduledEmails.id, row.id))
        log.warn({ id: row.id, retries: newRetryCount }, '⚠ Email fallido, reintentando')
      }
    }
  }
}

// ===== INSTAGRAM SCHEDULER =====
async function processScheduledPosts() {
  const now = new Date()

  const pending = await db.query.scheduledPosts.findMany({
    where: and(
      eq(scheduledPosts.status, 'pending'),
      lte(scheduledPosts.scheduledAt, now),
      or(isNull(scheduledPosts.nextRetryAt), lte(scheduledPosts.nextRetryAt, now)),
    ),
    with: { user: { columns: { instagramId: true, instagramAccessToken: true, instagramUsername: true } } },
  })

  for (const row of pending) {
    try {
      const igId = (row as { user?: { instagramId?: string | null } }).user?.instagramId
      const igToken = (row as { user?: { instagramAccessToken?: string | null } }).user?.instagramAccessToken

      if (!igId || !igToken) {
        throw new Error('Usuario sin cuenta de Instagram conectada')
      }

      const pages = JSON.parse(row.renderConfig) as RenderPage[]
      const pageArray = Array.isArray(pages) ? pages : [pages]

      let lastMediaId = ''
      let lastPostUrl = ''

      for (const page of pageArray) {
        const pngBuf = await renderMenu({ ...page, output_format: 'png' })
        const filename = `${randomUUID()}.png`
        const filepath = path.join(TEMP_DIR, filename)
        await fs.writeFile(filepath, pngBuf)

        const imageUrl = `${env.APP_BASE_URL}/storage/temp/${filename}`
        const { mediaId, postUrl } = await publishStory(igId, igToken, imageUrl)

        // Limpiar después de 10 minutos
        setTimeout(() => fs.unlink(filepath).catch(() => null), 10 * 60_000)

        lastMediaId = mediaId
        lastPostUrl = postUrl
      }

      await db
        .update(scheduledPosts)
        .set({ status: 'published', igMediaId: lastMediaId, igPostUrl: lastPostUrl })
        .where(eq(scheduledPosts.id, row.id))

      log.info({ id: row.id, mediaId: lastMediaId }, '📸 Post IG publicado')
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      const newRetryCount = row.retryCount + 1

      if (newRetryCount >= MAX_RETRIES) {
        await db
          .update(scheduledPosts)
          .set({ status: 'failed', errorMsg: error.message })
          .where(eq(scheduledPosts.id, row.id))
        log.error({ id: row.id, err: error }, '❌ Post IG fallido definitivamente')
      } else {
        await db
          .update(scheduledPosts)
          .set({ retryCount: newRetryCount, nextRetryAt: retryDelay(newRetryCount), errorMsg: error.message })
          .where(eq(scheduledPosts.id, row.id))
        log.warn({ id: row.id, retries: newRetryCount }, '⚠ Post IG fallido, reintentando')
      }
    }
  }
}

export function startScheduler(logger: Logger) {
  log = logger
  log.info('🕐 Scheduler arrancado')

  emailInterval = setInterval(() => {
    processScheduledEmails().catch((err) => log.error({ err }, 'Error en scheduler de emails'))
  }, INTERVAL_MS)

  igInterval = setInterval(() => {
    processScheduledPosts().catch((err) => log.error({ err }, 'Error en scheduler de IG'))
  }, INTERVAL_MS)

  // Ejecutar inmediatamente al arrancar
  processScheduledEmails().catch((err) => log.error({ err }, 'Error en scheduler de emails (inicial)'))
  processScheduledPosts().catch((err) => log.error({ err }, 'Error en scheduler de IG (inicial)'))
}

export function stopScheduler() {
  if (emailInterval) clearInterval(emailInterval)
  if (igInterval) clearInterval(igInterval)
}
