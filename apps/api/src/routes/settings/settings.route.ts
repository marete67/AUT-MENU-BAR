import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../../db/index.js'
import { users } from '../../db/schema.js'
import { AppError } from '../../errors/AppError.js'

const UpdateSettingsSchema = z.object({
  maxPublicLinks: z.number().int().min(1).max(20).optional(),
})

export default async function settingsRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: fastify.authenticate }

  // GET /api/settings
  fastify.get('/settings', auth, async (req, reply) => {
    const [user] = await db
      .select({ maxPublicLinks: users.maxPublicLinks })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1)

    if (!user) throw AppError.notFound('Usuario no encontrado')
    return reply.send({ maxPublicLinks: user.maxPublicLinks })
  })

  // PATCH /api/settings
  fastify.patch('/settings', auth, async (req, reply) => {
    const body = UpdateSettingsSchema.parse(req.body)
    const updates: Partial<typeof users.$inferInsert> = {}

    if (body.maxPublicLinks !== undefined) updates.maxPublicLinks = body.maxPublicLinks

    if (Object.keys(updates).length > 0) {
      await db.update(users).set(updates).where(eq(users.id, req.user.id))
    }

    return reply.send({ ok: true })
  })
}
