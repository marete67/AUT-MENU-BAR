import '../config/loadEnv.js'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/mysql2/migrator'
import { db, closeDbPool } from './index.js'

async function runMigrations() {
  console.log('🔄 Ejecutando migraciones...')
  // Apunta a apps/api/drizzle/ independientemente de desde dónde se ejecute
  const migrationsFolder = resolve(fileURLToPath(import.meta.url), '../../../drizzle')
  await migrate(db, { migrationsFolder })
  console.log('✅ Migraciones completadas')
  await closeDbPool()
}

runMigrations().catch((err) => {
  console.error('❌ Error en migraciones:', err)
  process.exit(1)
})
