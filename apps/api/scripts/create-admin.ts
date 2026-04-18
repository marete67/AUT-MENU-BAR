import '../src/config/loadEnv.js'
import { createInterface } from 'node:readline/promises'
import { db, closeDbPool } from '../src/db/index.js'
import { users } from '../src/db/schema.js'
import { hashPassword } from '../src/services/auth.service.js'
import { eq } from 'drizzle-orm'

const rl = createInterface({ input: process.stdin, output: process.stdout })

async function main() {
  console.log('\n[ MENU BAR ] — Crear usuario administrador\n')

  const username = (await rl.question('Nombre de usuario: ')).trim()
  if (!username || username.length > 50) {
    console.error('❌ Nombre de usuario inválido (máx. 50 caracteres)')
    process.exit(1)
  }

  const password = (await rl.question('Contraseña (mín. 8 caracteres): ')).trim()
  if (password.length < 8) {
    console.error('❌ La contraseña debe tener al menos 8 caracteres')
    process.exit(1)
  }

  const confirm = (await rl.question('Confirmar contraseña: ')).trim()
  if (password !== confirm) {
    console.error('❌ Las contraseñas no coinciden')
    process.exit(1)
  }

  rl.close()

  // Verificar si ya existe
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  if (existing) {
    console.error(`❌ El usuario "${username}" ya existe`)
    await closeDbPool()
    process.exit(1)
  }

  const passwordHash = await hashPassword(password)
  await db.insert(users).values({ username, passwordHash })

  console.log(`\n✅ Usuario "${username}" creado correctamente`)
  await closeDbPool()
}

main().catch((err) => {
  console.error('❌ Error:', err)
  process.exit(1)
})
