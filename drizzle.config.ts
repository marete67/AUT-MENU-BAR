import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './apps/api/src/db/schema.ts',
  out: './apps/api/drizzle',
  dialect: 'mysql',
  dbCredentials: {
    host: process.env['DB_HOST'] ?? '127.0.0.1',
    port: Number(process.env['DB_PORT'] ?? 3306),
    user: process.env['DB_USER'] ?? '',
    password: process.env['DB_PASS'] ?? '',
    database: process.env['DB_NAME'] ?? '',
  },
})
