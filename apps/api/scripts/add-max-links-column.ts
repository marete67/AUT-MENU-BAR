import '../src/config/loadEnv.js'
import { db, closeDbPool } from '../src/db/index.js'
import { sql } from 'drizzle-orm'

async function main() {
  console.log('Añadiendo columna max_public_links a users...')

  await db.execute(sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS max_public_links INT NOT NULL DEFAULT 3
  `)

  console.log('✅ Columna añadida (o ya existía)')
  await closeDbPool()
}

main().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
