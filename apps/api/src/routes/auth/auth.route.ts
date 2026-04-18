import type { FastifyInstance } from 'fastify'
import { LoginBodySchema, ChangePasswordBodySchema } from '@menu-bar/shared'
import * as authService from '../../services/auth.service.js'

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/login
  fastify.post('/auth/login', {
    config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
    handler: async (req, reply) => {
      const body = LoginBodySchema.parse(req.body)
      const user = await authService.findUserByCredentials(body.username, body.password)
      const token = fastify.jwt.sign({ id: user.id, username: user.username })
      return reply.send({ token, username: user.username })
    },
  })

  // GET /api/auth/me
  fastify.get('/auth/me', {
    preHandler: fastify.authenticate,
    handler: async (req, reply) => {
      const user = await authService.findUserById(req.user.id)
      return reply.send({
        id: user.id,
        username: user.username,
        createdAt: user.createdAt.toISOString(),
      })
    },
  })

  // PUT /api/auth/me/password
  fastify.put('/auth/me/password', {
    preHandler: fastify.authenticate,
    handler: async (req, reply) => {
      const body = ChangePasswordBodySchema.parse(req.body)
      await authService.changePassword(req.user.id, body.current, body.newPassword)
      return reply.send({ ok: true })
    },
  })

  // POST /api/auth/logout (invalida el token en el cliente)
  fastify.post('/auth/logout', {
    preHandler: fastify.authenticate,
    handler: async (_req, reply) => {
      // Con JWT stateless, el logout es responsabilidad del cliente (borrar el token)
      return reply.send({ ok: true })
    },
  })
}
