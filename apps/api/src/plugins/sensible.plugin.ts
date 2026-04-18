import fp from 'fastify-plugin'
import type { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify'
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

}

export default fp(sensiblePlugin, { name: 'sensible' })
