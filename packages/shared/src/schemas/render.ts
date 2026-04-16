import { z } from 'zod'
import { TemplateConfigSchema } from './template.js'

export const RenderPageSchema = TemplateConfigSchema.extend({
  output_format: z.enum(['png', 'jpg', 'jpeg']).default('png'),
  file_name: z.string().optional(),
}).refine(
  (data) => data.fondo_png !== undefined || data.fondo_b64 !== undefined,
  { message: 'Se requiere fondo_png o fondo_b64' },
)

export const RenderBodySchema = RenderPageSchema

export type RenderPage = z.infer<typeof RenderPageSchema>
export type RenderBody = z.infer<typeof RenderBodySchema>
