import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { publicLinks } from '../../db/schema.js'
import { buildViewerHTML } from '../../services/links.service.js'

export default async function viewerRoutes(fastify: FastifyInstance) {
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
