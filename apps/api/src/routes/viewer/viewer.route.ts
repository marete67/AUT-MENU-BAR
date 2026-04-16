import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { publicLinks } from '../../db/schema.js'
import { buildViewerHTML } from '../../services/links.service.js'

export default async function viewerRoutes(fastify: FastifyInstance) {
  // Middleware de dominio personalizado — antes de cualquier otra ruta
  fastify.addHook('onRequest', async (req, reply) => {
    const host = req.hostname
    // Ignorar el propio servidor y localhost
    if (host === 'localhost' || host === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return

    try {
      const [link] = await db
        .select()
        .from(publicLinks)
        .where(eq(publicLinks.customDomain, host))
        .limit(1)

      if (link) {
        return reply
          .header('Content-Type', 'text/html; charset=utf-8')
          .send(buildViewerHTML(link))
      }
    } catch (err) {
      req.log.error({ err, host }, 'Error en middleware de dominio personalizado')
    }
  })

  // GET /p/:slug
  fastify.get<{ Params: { slug: string } }>('/p/:slug', async (req, reply) => {
    const [link] = await db
      .select()
      .from(publicLinks)
      .where(eq(publicLinks.slug, req.params.slug))
      .limit(1)

    return reply
      .header('Content-Type', 'text/html; charset=utf-8')
      .send(buildViewerHTML(link ?? null))
  })
}
