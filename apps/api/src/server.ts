import './config/loadEnv.js'
import { buildApp } from './app.js'
import { checkDbConnection, closeDbPool } from './db/index.js'
import { env } from './config/env.js'
import { startScheduler, stopScheduler } from './services/scheduler.service.js'

async function main() {
  const app = await buildApp()

  // Verificar conexión a BD antes de arrancar
  try {
    await checkDbConnection()
    app.log.info('✅ Base de datos conectada')
  } catch (err) {
    app.log.error({ err }, '❌ No se pudo conectar a la base de datos')
    process.exit(1)
  }

  // Arrancar servidor
  await app.listen({ port: env.PORT, host: '0.0.0.0' })

  // Arrancar scheduler
  startScheduler(app.log)

  // ===== GRACEFUL SHUTDOWN =====
  const shutdown = async (signal: string) => {
    app.log.info(`${signal} recibido, cerrando servidor...`)

    stopScheduler()

    await app.close()
    await closeDbPool()

    app.log.info('Servidor cerrado correctamente')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  process.on('uncaughtException', (err) => {
    app.log.fatal({ err }, 'uncaughtException — cerrando')
    shutdown('uncaughtException').catch(() => process.exit(1))
  })

  process.on('unhandledRejection', (reason) => {
    app.log.fatal({ reason }, 'unhandledRejection — cerrando')
    shutdown('unhandledRejection').catch(() => process.exit(1))
  })
}

main().catch((err) => {
  console.error('❌ Error al arrancar:', err)
  process.exit(1)
})
