import { z } from 'zod'

export const UpdateSettingsBodySchema = z.object({
  maxPublicLinks: z.number().int().min(1).max(20).optional(),
})

export type UpdateSettingsBody = z.infer<typeof UpdateSettingsBodySchema>

export interface SettingsResponse {
  maxPublicLinks: number
}
