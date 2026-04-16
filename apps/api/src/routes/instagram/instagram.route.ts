import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { users } from '../../db/schema.js'
import {
  buildOAuthURL,
  exchangeCodeForLongLivedToken,
  getInstagramBusinessAccount,
} from '../../services/instagram.service.js'
import { AppError } from '../../errors/AppError.js'

export default async function instagramRoutes(fastify: FastifyInstance) {
  const auth = { preHandler: fastify.authenticate }

  // GET /api/instagram/status
  fastify.get('/instagram/status', auth, async (req, reply) => {
    const [user] = await db
      .select({
        instagramId: users.instagramId,
        instagramUsername: users.instagramUsername,
        instagramTokenExpiresAt: users.instagramTokenExpiresAt,
      })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1)

    if (!user?.instagramId) return reply.send({ connected: false })

    return reply.send({
      connected: true,
      username: user.instagramUsername,
      expiresAt: user.instagramTokenExpiresAt?.toISOString(),
    })
  })

  // GET /api/instagram/connect — redirige al OAuth de Meta
  fastify.get('/instagram/connect', auth, async (req, reply) => {
    // Estado firmado con JWT para validar el callback
    const state = fastify.jwt.sign({ userId: req.user.id }, { expiresIn: '10m' })
    const url = buildOAuthURL(state)
    return reply.redirect(url)
  })

  // GET /api/instagram/callback — callback OAuth (sin auth, viene del navegador)
  fastify.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    '/instagram/callback',
    async (req, reply) => {
      const { code, state, error } = req.query

      if (error) {
        return reply.redirect(`/?ig_error=${encodeURIComponent(error)}`)
      }

      if (!code || !state) {
        return reply.redirect('/?ig_error=missing_params')
      }

      let userId: number
      try {
        const payload = fastify.jwt.verify<{ userId: number }>(state)
        userId = payload.userId
      } catch {
        throw AppError.badRequest('Estado OAuth inválido o expirado')
      }

      try {
        const { accessToken, expiresAt } = await exchangeCodeForLongLivedToken(code)
        const { igId, igUsername } = await getInstagramBusinessAccount(accessToken)

        await db.update(users).set({
          instagramId: igId,
          instagramAccessToken: accessToken,
          instagramTokenExpiresAt: expiresAt,
          instagramUsername: igUsername,
        }).where(eq(users.id, userId))

        return reply.redirect(`/dashboard?ig_connected=1&ig_username=${encodeURIComponent(igUsername)}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Error desconocido'
        req.log.error({ err }, 'IG OAuth callback error')
        return reply.redirect(`/dashboard?ig_error=${encodeURIComponent(message)}`)
      }
    },
  )

  // DELETE /api/instagram/disconnect
  fastify.delete('/instagram/disconnect', auth, async (req, reply) => {
    await db.update(users).set({
      instagramId: null,
      instagramAccessToken: null,
      instagramTokenExpiresAt: null,
      instagramUsername: null,
    }).where(eq(users.id, req.user.id))

    return reply.send({ ok: true })
  })
}
