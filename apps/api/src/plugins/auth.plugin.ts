import fp from 'fastify-plugin'
import fastifyJwt from '@fastify/jwt'
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { env } from '../config/env.js'
import { AppError } from '../errors/AppError.js'

export interface JwtPayload {
  id: number
  username: string
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}

async function authPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { algorithm: 'HS256', expiresIn: '7d' },
  })

  // Decoramos la instancia con el hook de autenticación
  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await request.jwtVerify()
      } catch {
        throw AppError.unauthorized('Token inválido o expirado')
      }
    },
  )
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

export default fp(authPlugin, { name: 'auth' })
