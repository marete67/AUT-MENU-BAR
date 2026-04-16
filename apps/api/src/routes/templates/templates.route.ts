import type { FastifyInstance } from 'fastify'
import { eq, and, desc } from 'drizzle-orm'
import { CreateTemplateBodySchema, UpdateTemplateBodySchema } from '@menu-bar/shared'
import { db } from '../../db/index.js'
import { templates } from '../../db/schema.js'
import { AppError } from '../../errors/AppError.js'

export default async function templateRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: fastify.authenticate }

  // GET /api/templates
  fastify.get('/templates', auth, async (req, reply) => {
    const rows = await db
      .select({ id: templates.id, name: templates.name, createdAt: templates.createdAt, updatedAt: templates.updatedAt })
      .from(templates)
      .where(eq(templates.userId, req.user.id))
      .orderBy(desc(templates.updatedAt))

    return reply.send(rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })))
  })

  // GET /api/templates/:id
  fastify.get<{ Params: { id: string } }>('/templates/:id', auth, async (req, reply) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) throw AppError.badRequest('ID inválido')

    const [row] = await db
      .select()
      .from(templates)
      .where(and(eq(templates.id, id), eq(templates.userId, req.user.id)))
      .limit(1)

    if (!row) throw AppError.notFound('Plantilla no encontrada')

    return reply.send({
      id: row.id,
      name: row.name,
      config: JSON.parse(row.config),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    })
  })

  // POST /api/templates
  fastify.post('/templates', auth, async (req, reply) => {
    const body = CreateTemplateBodySchema.parse(req.body)

    const [result] = await db.insert(templates).values({
      userId: req.user.id,
      name: body.name,
      config: JSON.stringify(body.config),
    })

    return reply.status(201).send({ id: result.insertId, name: body.name })
  })

  // PUT /api/templates/:id
  fastify.put<{ Params: { id: string } }>('/templates/:id', auth, async (req, reply) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) throw AppError.badRequest('ID inválido')

    const body = UpdateTemplateBodySchema.parse(req.body)

    const updates: Partial<typeof templates.$inferInsert> = {}
    if (body.name !== undefined) updates.name = body.name
    if (body.config !== undefined) updates.config = JSON.stringify(body.config)

    if (Object.keys(updates).length === 0) return reply.send({ ok: true })

    await db
      .update(templates)
      .set(updates)
      .where(and(eq(templates.id, id), eq(templates.userId, req.user.id)))

    return reply.send({ ok: true })
  })

  // DELETE /api/templates/:id
  fastify.delete<{ Params: { id: string } }>('/templates/:id', auth, async (req, reply) => {
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) throw AppError.badRequest('ID inválido')

    await db
      .delete(templates)
      .where(and(eq(templates.id, id), eq(templates.userId, req.user.id)))

    return reply.send({ ok: true })
  })
}
