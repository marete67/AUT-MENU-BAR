import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'
import { env } from '../config/env.js'
import * as schema from './schema.js'

const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  database: env.DB_NAME,
  user: env.DB_USER,
  password: env.DB_PASS,
  waitForConnections: true,
  connectionLimit: 10,
  idleTimeout: 60000,
  enableKeepAlive: true,
})

export const db = drizzle(pool, { schema, mode: 'default' })
export type DB = typeof db

// Verificar conexión al arrancar
export async function checkDbConnection(): Promise<void> {
  const conn = await pool.getConnection()
  await conn.ping()
  conn.release()
}

export async function closeDbPool(): Promise<void> {
  await pool.end()
}
