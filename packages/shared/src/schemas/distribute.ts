import { z } from 'zod'
import { RenderPageSchema } from './render.js'

const futureDatetime = z
  .string()
  .datetime({ offset: true, message: 'Formato ISO 8601 requerido' })
  .refine((val) => new Date(val) > new Date(), {
    message: 'La fecha debe ser futura',
  })

// ===== EMAIL =====
export const DistributeEmailBodySchema = z.object({
  pages: z.array(RenderPageSchema).min(1, 'Se requiere al menos una página'),
  email_to: z.string().email('Email inválido'),
  subject: z.string().max(255).optional(),
  template_name: z.string().max(255).optional(),
})

export const ScheduleEmailBodySchema = DistributeEmailBodySchema.extend({
  send_at: futureDatetime,
})

export const ScheduledEmailResponseSchema = z.object({
  id: z.number(),
  template_name: z.string().nullable(),
  email_to: z.string(),
  subject: z.string().nullable(),
  send_at: z.string(),
  status: z.enum(['pending', 'sent', 'failed']),
  retry_count: z.number(),
})

// ===== INSTAGRAM =====
export const DistributeIgBodySchema = z.object({
  pages: z.array(RenderPageSchema).min(1, 'Se requiere al menos una página'),
})

export const ScheduleIgBodySchema = DistributeIgBodySchema.extend({
  scheduled_at: futureDatetime,
  template_name: z.string().max(255).optional(),
})

export const ScheduledIgResponseSchema = z.object({
  id: z.number(),
  template_name: z.string().nullable(),
  scheduled_at: z.string(),
  status: z.enum(['pending', 'published', 'failed']),
  retry_count: z.number(),
})

export type DistributeEmailBody = z.infer<typeof DistributeEmailBodySchema>
export type ScheduleEmailBody = z.infer<typeof ScheduleEmailBodySchema>
export type DistributeIgBody = z.infer<typeof DistributeIgBodySchema>
export type ScheduleIgBody = z.infer<typeof ScheduleIgBodySchema>
export type ScheduledEmailResponse = z.infer<typeof ScheduledEmailResponseSchema>
export type ScheduledIgResponse = z.infer<typeof ScheduledIgResponseSchema>
