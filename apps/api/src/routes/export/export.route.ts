import type { FastifyInstance } from 'fastify'
import { ExportBodySchema } from '@menu-bar/shared'
import { exportPdf, exportZip } from '../../services/export.service.js'

export default async function exportRoutes(fastify: FastifyInstance) {
  fastify.post('/export', {
    preHandler: fastify.authenticate,
    handler: async (req, reply) => {
      const body = ExportBodySchema.parse(req.body)

      if (body.format === 'pdf') {
        reply.header('Content-Type', 'application/pdf')
        reply.header('Content-Disposition', 'attachment; filename="menu.pdf"')
        await exportPdf(body.pages, reply.raw)
      } else {
        reply.header('Content-Type', 'application/zip')
        reply.header('Content-Disposition', 'attachment; filename="menus.zip"')
        await exportZip(body.pages, reply.raw)
      }
    },
  })
}
