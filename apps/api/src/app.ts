import './config/loadEnv.js'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import staticFiles from '@fastify/static'
import path from 'node:path'
import fs from 'node:fs'

import { env } from './config/env.js'
import authPlugin from './plugins/auth.plugin.js'
import sensiblePlugin from './plugins/sensible.plugin.js'
import { db } from './db/index.js'
import { publicLinks } from './db/schema.js'
import { buildViewerHTML } from './services/links.service.js'
import { eq } from 'drizzle-orm'

import authRoutes from './routes/auth/auth.route.js'
import templateRoutes from './routes/templates/templates.route.js'
import renderRoutes from './routes/render/render.route.js'
import distributeRoutes from './routes/distribute/distribute.route.js'
import exportRoutes from './routes/export/export.route.js'
import instagramRoutes from './routes/instagram/instagram.route.js'
import linksRoutes from './routes/links/links.route.js'
import settingsRoutes from './routes/settings/settings.route.js'
import viewerRoutes from './routes/viewer/viewer.route.js'

// En Docker el proceso arranca en /app/apps/api (pnpm filter cambia el CWD al paquete).
// Subimos dos niveles para llegar a la raíz del monorepo (/app).
const CWD = process.cwd()
const MONO_ROOT = path.resolve(CWD, '../../')

export const STORAGE_DIR = path.resolve(process.env['STORAGE_DIR'] ?? path.join(MONO_ROOT, 'storage'))
export const WEB_DIST    = path.resolve(process.env['WEB_DIST_DIR'] ?? path.join(MONO_ROOT, 'apps/web/dist'))
export const ASSETS_DIR  = path.resolve(process.env['ASSETS_DIR'] ?? path.join(MONO_ROOT, 'assets'))

// Garantizar que los directorios de storage existen al arrancar
for (const dir of ['temp', 'public_pages', 'fonts/cache'].map((d) => path.join(STORAGE_DIR, d))) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

export async function buildApp() {
  const app = Fastify({
    bodyLimit: 25 * 1024 * 1024,
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      ...(env.NODE_ENV !== 'production'
        ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
        : {}),
    },
  })

  // ===== SEGURIDAD =====
  await app.register(helmet, {
    contentSecurityPolicy: false, // El viewer público necesita inline styles
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })

  await app.register(cors, {
    origin: env.NODE_ENV === 'production' ? env.APP_BASE_URL : true,
    credentials: true,
  })

  await app.register(rateLimit, {
    global: false,
    max: 100,
    timeWindow: '1 minute',
  })

  // ===== PLUGINS =====
  await app.register(authPlugin)
  await app.register(sensiblePlugin)

  // ===== DOMINIO PERSONALIZADO (hook global) =====
  // Intercepta cualquier petición cuyo Host no sea el propio servidor.
  // Si el host coincide con el custom_domain de un public link, sirve el viewer
  // directamente — sin llegar al SPA fallback ni a ninguna ruta de API.
  const ownHost = (() => {
    try { return new URL(env.APP_BASE_URL).hostname } catch { return '' }
  })()

  app.addHook('onRequest', async (req, reply) => {
    const host = req.hostname
    // Ignorar el propio servidor, localhost e IPs
    if (!host || host === ownHost || host === 'localhost' || host === '127.0.0.1' || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return
    // Ignorar rutas internas: health check, API, assets estáticos
    const url = req.url ?? '/'
    if (url.startsWith('/api/') || url.startsWith('/health') || url.startsWith('/storage/') || url.startsWith('/assets/')) return

    try {
      const [link] = await db
        .select()
        .from(publicLinks)
        .where(eq(publicLinks.customDomain, host))
        .limit(1)

      if (link) {
        return reply
          .header('Content-Type', 'text/html; charset=utf-8')
          .header('Cache-Control', 'public, max-age=60')
          .send(buildViewerHTML(link))
      }
    } catch (err) {
      req.log.error({ err, host }, 'Error en middleware de dominio personalizado')
    }
  })

  // ===== HEALTH CHECK =====
  // Coolify hace ping a esta ruta para saber si el contenedor está listo
  app.get('/health', async (_req, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString() })
  })

  // ===== FICHEROS ESTÁTICOS =====
  if (env.NODE_ENV === 'production') {
    await app.register(staticFiles, {
      root: WEB_DIST,
      prefix: '/',
      decorateReply: false,
      wildcard: false,
    })
  }

  await app.register(staticFiles, {
    root: path.join(STORAGE_DIR, 'temp'),
    prefix: '/storage/temp/',
    decorateReply: false,
  })

  await app.register(staticFiles, {
    root: path.join(STORAGE_DIR, 'public_pages'),
    prefix: '/storage/public_pages/',
    decorateReply: false,
  })

  // ===== SPA FALLBACK =====
  // Sirve index.html para cualquier GET que no sea un fichero estático ni una ruta de API.
  // Debe registrarse ANTES de las rutas de API para que Fastify lo trate como ruta wildcard,
  // pero @fastify/static ya ha reservado los ficheros reales, así que solo llega aquí
  // lo que no se ha resuelto antes.
  if (env.NODE_ENV === 'production') {
    app.get('/*', (_req, reply) => {
      const indexPath = path.join(WEB_DIST, 'index.html')
      if (fs.existsSync(indexPath)) {
        return reply.type('text/html').send(fs.readFileSync(indexPath))
      }
      return reply.status(404).send({ error: 'index.html not found' })
    })
  }

  // ===== RUTAS API =====
  await app.register(authRoutes,      { prefix: '/api' })
  await app.register(templateRoutes,  { prefix: '/api' })
  await app.register(renderRoutes,    { prefix: '/api' })
  await app.register(distributeRoutes,{ prefix: '/api' })
  await app.register(exportRoutes,    { prefix: '/api' })
  await app.register(instagramRoutes, { prefix: '/api' })
  await app.register(linksRoutes,     { prefix: '/api' })
  await app.register(settingsRoutes,  { prefix: '/api' })
  await app.register(viewerRoutes)


  return app
}
