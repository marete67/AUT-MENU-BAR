import { z } from 'zod'
import { RenderPageSchema } from './render.js'

export const CreateLinkBodySchema = z.object({
  name: z.string().min(1).max(80).default('Mi Menú'),
})

export const UpdateLinkBodySchema = z.object({
  name: z.string().min(1).max(80).optional(),
  custom_domain: z.string().max(255).toLowerCase().trim().nullable().optional(),
})

export const PublishLinkBodySchema = z.object({
  pages: z.array(RenderPageSchema).min(1, 'Se requiere al menos una página'),
})

export const LinkResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  page_count: z.number(),
  last_published_at: z.string().nullable(),
  custom_domain: z.string().nullable(),
})

export type CreateLinkBody = z.infer<typeof CreateLinkBodySchema>
export type UpdateLinkBody = z.infer<typeof UpdateLinkBodySchema>
export type PublishLinkBody = z.infer<typeof PublishLinkBodySchema>
export type LinkResponse = z.infer<typeof LinkResponseSchema>
