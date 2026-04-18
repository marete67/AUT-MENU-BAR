import type { FastifyInstance } from 'fastify'
import { RenderBodySchema } from '@menu-bar/shared'
import { renderMenu } from '../../render/renderMenu.js'

export default async function renderRoutes(fastify: FastifyInstance) {
  fastify.post('/render', {
    preHandler: fastify.authenticate,
    handler: async (req, reply) => {
      const body = RenderBodySchema.parse(req.body)
      const buf = await renderMenu(body)

      const contentType = body.output_format === 'jpg' || body.output_format === 'jpeg'
        ? 'image/jpeg'
        : 'image/png'

      return reply
        .header('Content-Type', contentType)
        .header('Content-Disposition', `inline; filename="${body.file_name ?? 'menu.png'}"`)
        .send(buf)
    },
  })
}
