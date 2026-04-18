/**
 * Carga el .env buscando desde el directorio actual hacia arriba.
 * Funciona tanto si se ejecuta desde apps/api como desde la raíz del monorepo.
 */
import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

const candidates = [
  // Ejecutado desde apps/api/src/config/ (tsx directo)
  resolve(fileURLToPath(import.meta.url), '../../../../../.env'),
  // Ejecutado desde la raíz del monorepo
  resolve(process.cwd(), '.env'),
  // Ejecutado desde apps/api/
  resolve(process.cwd(), '../../.env'),
]

for (const p of candidates) {
  if (existsSync(p)) {
    config({ path: p })
    break
  }
}
