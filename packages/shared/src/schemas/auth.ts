import { z } from 'zod'

export const LoginBodySchema = z.object({
  username: z.string().min(1, 'Usuario requerido').max(50),
  password: z.string().min(1, 'Contraseña requerida'),
})

export const LoginResponseSchema = z.object({
  token: z.string(),
  username: z.string(),
})

export const MeResponseSchema = z.object({
  id: z.number(),
  username: z.string(),
  createdAt: z.string(),
})

export const ChangePasswordBodySchema = z.object({
  current: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .max(100)
    .regex(/[A-Z]/, 'Debe contener al menos una mayúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número'),
})

export type LoginBody = z.infer<typeof LoginBodySchema>
export type LoginResponse = z.infer<typeof LoginResponseSchema>
export type MeResponse = z.infer<typeof MeResponseSchema>
export type ChangePasswordBody = z.infer<typeof ChangePasswordBodySchema>
