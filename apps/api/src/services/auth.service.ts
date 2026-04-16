import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { AppError } from '../errors/AppError.js'

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export async function findUserByCredentials(username: string, password: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  if (!user) throw AppError.unauthorized('Usuario o contraseña incorrectos')

  const valid = await verifyPassword(password, user.passwordHash)
  if (!valid) throw AppError.unauthorized('Usuario o contraseña incorrectos')

  return { id: user.id, username: user.username }
}

export async function findUserById(id: number) {
  const [user] = await db
    .select({ id: users.id, username: users.username, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, id))
    .limit(1)

  if (!user) throw AppError.notFound('Usuario no encontrado')
  return user
}

export async function changePassword(userId: number, current: string, newPassword: string) {
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) throw AppError.notFound('Usuario no encontrado')

  const valid = await verifyPassword(current, user.passwordHash)
  if (!valid) throw AppError.unauthorized('Contraseña actual incorrecta')

  const newHash = await hashPassword(newPassword)
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, userId))
}
