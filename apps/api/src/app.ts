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

import authRoutes from './routes/auth/auth.route.js'
import templateRoutes from './routes/templates/templates.route.js'
import renderRoutes from './routes/render/render.route.js'
import distributeRoutes from './routes/distribute/distribute.route.js'
import exportRoutes from './routes/export/export.route.js'
import instagramRoutes from './routes/instagram/instagram.route.js'
import linksRoutes from './routes/links/links.route.js'
import settingsRoutes from './routes/settings/settings.route.js'
import viewerRoutes from './routes/viewer/viewer.route.js'

// En producción (Docker), el CWD es /app y la estructura es plana.
// En desarrollo, el CWD es la raíz del monorepo.
const CWD = process.cwd()

export const STORAGE_DIR = path.resolve(process.env['STORAGE_DIR'] ?? path.join(CWD, 'storage'))
export const WEB_DIST    = path.resolve(process.env['WEB_DIST_DIR'] ?? path.join(CWD, 'apps/web/dist'))
export const ASSETS_DIR  = path.resolve(process.env['ASSETS_DIR'] ?? path.join(CWD, 'assets'))

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

  // ===== SPA FALLBACK (producción) =====
  if (env.NODE_ENV === 'production') {
    app.setNotFoundHandler(async (_req, reply) => {
      return reply.sendFile('index.html', WEB_DIST)
    })
  }

  return app
}
