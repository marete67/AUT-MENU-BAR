import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify'
import fs from 'node:fs'
import path from 'node:path'
import { ZodError } from 'zod'
import { AppError } from '../errors/AppError.js'
import { env } from '../config/env.js'

async function sensiblePlugin(fastify: FastifyInstance) {
  // Handler global de errores
  fastify.setErrorHandler(
    (error: FastifyError | AppError | ZodError | Error, request: FastifyRequest, reply: FastifyReply) => {
      // Zod validation errors
      if (error instanceof ZodError) {
        return reply.status(422).send({
          error: 'Datos inválidos',
          details: error.flatten().fieldErrors,
        })
      }

      // Errores de aplicación conocidos
      if (error instanceof AppError) {
        return reply.status(error.statusCode).send({
          error: error.message,
          code: error.code,
        })
      }

      // Errores JWT de @fastify/jwt
      if ('statusCode' in error && error.statusCode === 401) {
        return reply.status(401).send({ error: 'No autorizado' })
      }

      // Errores de rate limit
      if ('statusCode' in error && error.statusCode === 429) {
        return reply.status(429).send({ error: 'Demasiadas peticiones, intenta más tarde' })
      }

      // Error desconocido — log completo, respuesta genérica
      request.log.error({ err: error }, 'Unhandled error')
      return reply.status(500).send({
        error: env.NODE_ENV === 'production' ? 'Error interno del servidor' : error.message,
      })
    },
  )

  // 404 handler — en producción sirve index.html para el SPA fallback
  fastify.setNotFoundHandler((request, reply) => {
    if (env.NODE_ENV === 'production' && request.method === 'GET') {
      const webDist = path.resolve(process.env['WEB_DIST_DIR'] ?? path.join(process.cwd(), '../../apps/web/dist'))
      const indexPath = path.join(webDist, 'index.html')
      if (fs.existsSync(indexPath)) {
        return reply.type('text/html').send(fs.readFileSync(indexPath))
      }
    }
    reply.status(404).send({ error: `Ruta no encontrada: ${request.method} ${request.url}` })
  })
}

export default fp(sensiblePlugin, { name: 'sensible' })
