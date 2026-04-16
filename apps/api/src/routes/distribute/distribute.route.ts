import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import {
  DistributeEmailBodySchema,
  ScheduleEmailBodySchema,
  DistributeIgBodySchema,
  ScheduleIgBodySchema,
} from '@menu-bar/shared'
import { db } from '../../db/index.js'
import { scheduledEmails, scheduledPosts, users } from '../../db/schema.js'
import { sendMenuEmail } from '../../services/email.service.js'
import { publishStory } from '../../services/instagram.service.js'
import { renderMenu } from '../../render/renderMenu.js'
import { AppError } from '../../errors/AppError.js'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { env } from '../../config/env.js'

const TEMP_DIR = path.join(
  path.resolve(process.env['STORAGE_DIR'] ?? path.join(process.cwd(), 'storage')),
  'temp',
)

export default async function distributeRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: fastify.authenticate }

  // ===== EMAIL INMEDIATO =====
  fastify.post('/distribute/email', auth, async (req, reply) => {
    const body = DistributeEmailBodySchema.parse(req.body)
    await sendMenuEmail({
      to: body.email_to,
      subject: body.subject ?? 'Menú',
      templateName: body.template_name ?? '',
      pages: body.pages,
    })
    return reply.send({ ok: true })
  })

  // ===== EMAIL PROGRAMADO =====
  fastify.post('/distribute/email/schedule', auth, async (req, reply) => {
    const body = ScheduleEmailBodySchema.parse(req.body)
    const [result] = await db.insert(scheduledEmails).values({
      userId: req.user.id,
      templateName: body.template_name ?? '',
      emailTo: body.email_to,
      subject: body.subject ?? 'Menú',
      sendAt: new Date(body.send_at),
      renderConfig: JSON.stringify(body.pages),
    })
    return reply.status(201).send({ ok: true, id: result.insertId })
  })

  // ===== LISTAR EMAILS PROGRAMADOS =====
  fastify.get('/distribute/email/scheduled', auth, async (req, reply) => {
    const rows = await db
      .select({
        id: scheduledEmails.id,
        template_name: scheduledEmails.templateName,
        email_to: scheduledEmails.emailTo,
        subject: scheduledEmails.subject,
        send_at: scheduledEmails.sendAt,
        status: scheduledEmails.status,
        retry_count: scheduledEmails.retryCount,
      })
      .from(scheduledEmails)
      .where(eq(scheduledEmails.userId, req.user.id))
      .orderBy(scheduledEmails.sendAt)

    return reply.send(rows.map((r) => ({ ...r, send_at: r.send_at.toISOString() })))
  })

  // ===== CANCELAR EMAIL PROGRAMADO =====
  fastify.delete<{ Params: { id: string } }>('/distribute/email/scheduled/:id', auth, async (req, reply) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) throw AppError.badRequest('ID inválido')

    await db
      .delete(scheduledEmails)
      .where(eq(scheduledEmails.id, id))

    return reply.send({ ok: true })
  })

  // ===== IG INMEDIATO =====
  fastify.post('/distribute/ig', auth, async (req, reply) => {
    const body = DistributeIgBodySchema.parse(req.body)

    const [user] = await db
      .select({ instagramId: users.instagramId, instagramAccessToken: users.instagramAccessToken })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1)

    if (!user?.instagramId || !user.instagramAccessToken) {
      throw AppError.badRequest('Instagram no conectado')
    }

    let lastPostUrl = ''
    for (const page of body.pages) {
      const pngBuf = await renderMenu({ ...page, output_format: 'png' })
      const filename = `${randomUUID()}.png`
      const filepath = path.join(TEMP_DIR, filename)
      await fs.writeFile(filepath, pngBuf)

      const imageUrl = `${env.APP_BASE_URL}/storage/temp/${filename}`
      const result = await publishStory(user.instagramId, user.instagramAccessToken, imageUrl)
      lastPostUrl = result.postUrl

      setTimeout(() => fs.unlink(filepath).catch(() => null), 10 * 60_000)
    }

    return reply.send({ ok: true, postUrl: lastPostUrl })
  })

  // ===== IG PROGRAMADO =====
  fastify.post('/distribute/ig/schedule', auth, async (req, reply) => {
    const body = ScheduleIgBodySchema.parse(req.body)

    const [user] = await db
      .select({ instagramId: users.instagramId })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1)

    if (!user?.instagramId) throw AppError.badRequest('Instagram no conectado')

    const [result] = await db.insert(scheduledPosts).values({
      userId: req.user.id,
      templateName: body.template_name ?? '',
      scheduledAt: new Date(body.scheduled_at),
      renderConfig: JSON.stringify(body.pages),
    })

    return reply.status(201).send({ ok: true, id: result.insertId })
  })

  // ===== LISTAR IG PROGRAMADOS =====
  fastify.get('/distribute/ig/scheduled', auth, async (req, reply) => {
    const rows = await db
      .select({
        id: scheduledPosts.id,
        template_name: scheduledPosts.templateName,
        scheduled_at: scheduledPosts.scheduledAt,
        status: scheduledPosts.status,
        retry_count: scheduledPosts.retryCount,
      })
      .from(scheduledPosts)
      .where(eq(scheduledPosts.userId, req.user.id))
      .orderBy(scheduledPosts.scheduledAt)

    return reply.send(rows.map((r) => ({ ...r, scheduled_at: r.scheduled_at.toISOString() })))
  })

  // ===== CANCELAR IG PROGRAMADO =====
  fastify.delete<{ Params: { id: string } }>('/distribute/ig/scheduled/:id', auth, async (req, reply) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) throw AppError.badRequest('ID inválido')

    await db
      .delete(scheduledPosts)
      .where(eq(scheduledPosts.id, id))

    return reply.send({ ok: true })
  })
}
