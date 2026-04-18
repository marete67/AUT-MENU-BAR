import { z } from 'zod'

export const BlockSchema = z.object({
  key: z.string().optional(),
  label: z.string().optional(),
  content: z.union([z.string(), z.array(z.string())]).optional(),
  type: z.enum(['variable', 'static']).default('variable'),
  font_family: z.string().optional(),
  font_size: z.number().positive().optional(),
  text_color: z.string().optional(),
  align: z.enum(['left', 'center', 'right']).default('right'),
  x: z.number(),
  y: z.number(),
  w: z.number().positive(),
  multiline: z.boolean().optional(),
  letter_spacing: z.number().optional(),
  line_height_factor: z.number().optional(),
})

export const TemplateConfigSchema = z.object({
  formato: z.enum(['story', 'folio']).default('story'),
  fondo_png: z.string().optional(),
  fondo_b64: z.string().optional(),
  fondo_locked: z.boolean().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  font_family: z.string().optional(),
  text_color: z.string().optional(),
  letter_spacing: z.number().optional(),
  line_height_factor: z.number().optional(),
  blocks: z.array(BlockSchema),
})

export const CreateTemplateBodySchema = z.object({
  name: z.string().min(1, 'Nombre requerido').max(255),
  config: TemplateConfigSchema,
})

export const UpdateTemplateBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: TemplateConfigSchema.optional(),
})

export const TemplateResponseSchema = z.object({
  id: z.number(),
  name: z.string(),
  config: TemplateConfigSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const TemplateListItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type Block = z.infer<typeof BlockSchema>
export type TemplateConfig = z.infer<typeof TemplateConfigSchema>
export type CreateTemplateBody = z.infer<typeof CreateTemplateBodySchema>
export type UpdateTemplateBody = z.infer<typeof UpdateTemplateBodySchema>
export type TemplateResponse = z.infer<typeof TemplateResponseSchema>
export type TemplateListItem = z.infer<typeof TemplateListItemSchema>
