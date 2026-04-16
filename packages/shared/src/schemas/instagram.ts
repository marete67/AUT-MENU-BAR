import { z } from 'zod'
import { RenderPageSchema } from './render.js'

export const IgPublishBodySchema = z.object({
  pages: z.array(RenderPageSchema).min(1, 'Se requiere al menos una página'),
})

export const IgScheduleBodySchema = IgPublishBodySchema.extend({
  scheduled_at: z
    .string()
    .datetime({ offset: true })
    .refine((val) => new Date(val) > new Date(), {
      message: 'La fecha debe ser futura',
    }),
  template_name: z.string().max(255).optional(),
})

export const IgStatusResponseSchema = z.discriminatedUnion('connected', [
  z.object({ connected: z.literal(false) }),
  z.object({
    connected: z.literal(true),
    username: z.string(),
    expiresAt: z.string(),
  }),
])

export type IgPublishBody = z.infer<typeof IgPublishBodySchema>
export type IgScheduleBody = z.infer<typeof IgScheduleBodySchema>
export type IgStatusResponse = z.infer<typeof IgStatusResponseSchema>
