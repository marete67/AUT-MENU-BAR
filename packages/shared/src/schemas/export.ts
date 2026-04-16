import { z } from 'zod'
import { RenderPageSchema } from './render.js'

export const ExportBodySchema = z.object({
  pages: z.array(RenderPageSchema).min(1, 'Se requiere al menos una página'),
  format: z.enum(['pdf', 'zip']).default('zip'),
})

export type ExportBody = z.infer<typeof ExportBodySchema>
