import type { FastifyInstance } from 'fastify'
import { randomBytes } from 'node:crypto'
import { eq, and, count } from 'drizzle-orm'
import { CreateLinkBodySchema, UpdateLinkBodySchema, PublishLinkBodySchema } from '@menu-bar/shared'
import { db } from '../../db/index.js'
import { publicLinks, users } from '../../db/schema.js'
import { publishLinkPages, deleteLinkStorage } from '../../services/links.service.js'
import { AppError } from '../../errors/AppError.js'
import { env } from '../../config/env.js'

export default async function linksRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: fastify.authenticate }

  // GET /api/links
  fastify.get('/links', auth, async (req, reply) => {
    const rows = await db
      .select({
        id: publicLinks.id,
        name: publicLinks.name,
        slug: publicLinks.slug,
        page_count: publicLinks.pageCount,
        last_published_at: publicLinks.lastPublishedAt,
        custom_domain: publicLinks.customDomain,
      })
      .from(publicLinks)
      .where(eq(publicLinks.userId, req.user.id))
      .orderBy(publicLinks.createdAt)

    return reply.send(rows.map((r) => ({
      ...r,
      last_published_at: r.last_published_at?.toISOString() ?? null,
    })))
  })

  // POST /api/links
  fastify.post('/links', auth, async (req, reply) => {
    const [countRows, userRows] = await Promise.all([
      db.select({ total: count() }).from(publicLinks).where(eq(publicLinks.userId, req.user.id)),
      db.select({ maxPublicLinks: users.maxPublicLinks }).from(users).where(eq(users.id, req.user.id)).limit(1),
    ])

    const total = countRows[0]?.total ?? 0
    const userRow = userRows[0]
    const max = userRow?.maxPublicLinks ?? 3
    if (total >= max) {
      throw AppError.conflict(`Máximo ${max} links públicos por cuenta`)
    }

    const body = CreateLinkBodySchema.parse(req.body)
    const slug = randomBytes(5).toString('hex')

    await db.insert(publicLinks).values({
      userId: req.user.id,
      name: body.name,
      slug,
    })

    return reply.status(201).send({ ok: true, slug, name: body.name })
  })

  // PUT /api/links/:id
  fastify.put<{ Params: { id: string } }>('/links/:id', auth, async (req, reply) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) throw AppError.badRequest('ID inválido')

    const body = UpdateLinkBodySchema.parse(req.body)
    const updates: Partial<typeof publicLinks.$inferInsert> = {}

    if (body.name !== undefined) updates.name = body.name
    if (body.custom_domain !== undefined) updates.customDomain = body.custom_domain ?? null

    if (Object.keys(updates).length === 0) return reply.send({ ok: true })

    await db
      .update(publicLinks)
      .set(updates)
      .where(and(eq(publicLinks.id, id), eq(publicLinks.userId, req.user.id)))

    return reply.send({ ok: true })
  })

  // DELETE /api/links/:id
  fastify.delete<{ Params: { id: string } }>('/links/:id', auth, async (req, reply) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) throw AppError.badRequest('ID inválido')

    const [link] = await db
      .select({ slug: publicLinks.slug })
      .from(publicLinks)
      .where(and(eq(publicLinks.id, id), eq(publicLinks.userId, req.user.id)))
      .limit(1)

    if (link) {
      await deleteLinkStorage(link.slug)
      await db.delete(publicLinks).where(eq(publicLinks.id, id))
    }

    return reply.send({ ok: true })
  })

  // POST /api/links/:id/publish
  fastify.post<{ Params: { id: string } }>('/links/:id/publish', auth, async (req, reply) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) throw AppError.badRequest('ID inválido')

    const body = PublishLinkBodySchema.parse(req.body)
    const slug = await publishLinkPages(id, req.user.id, body.pages)

    return reply.send({
      ok: true,
      url: `${env.APP_BASE_URL}/p/${slug}`,
    })
  })
}
