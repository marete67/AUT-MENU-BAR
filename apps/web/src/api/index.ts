import { api } from './client.js'
import type {
  LoginBody,
  LoginResponse,
  MeResponse,
  TemplateListItem,
  TemplateResponse,
  CreateTemplateBody,
  UpdateTemplateBody,
  RenderPage,
  DistributeEmailBody,
  ScheduleEmailBody,
  ScheduledEmailResponse,
  DistributeIgBody,
  ScheduleIgBody,
  ScheduledIgResponse,
  LinkResponse,
  CreateLinkBody,
  UpdateLinkBody,
  IgStatusResponse,
  ExportBody,
  SettingsResponse,
  UpdateSettingsBody,
} from '@menu-bar/shared'

// ===== AUTH =====
export const authApi = {
  login: (body: LoginBody) => api.post<LoginResponse>('/api/auth/login', body),
  me: () => api.get<MeResponse>('/api/auth/me'),
  changePassword: (body: { current: string; newPassword: string }) =>
    api.put<{ ok: boolean }>('/api/auth/me/password', body),
  logout: () => api.post<{ ok: boolean }>('/api/auth/logout'),
}

// ===== TEMPLATES =====
export const templatesApi = {
  list: () => api.get<TemplateListItem[]>('/api/templates'),
  get: (id: number) => api.get<TemplateResponse>(`/api/templates/${id}`),
  create: (body: CreateTemplateBody) => api.post<{ id: number; name: string }>('/api/templates', body),
  update: (id: number, body: UpdateTemplateBody) =>
    api.put<{ ok: boolean }>(`/api/templates/${id}`, body),
  delete: (id: number) => api.delete<{ ok: boolean }>(`/api/templates/${id}`),
}

// ===== RENDER =====
export const renderApi = {
  render: async (page: RenderPage): Promise<string> => {
    // Devuelve una URL de blob para previsualizar
    const auth = (await import('@/stores/auth.store.js')).useAuthStore()
    const res = await fetch('/api/render', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
      },
      body: JSON.stringify(page),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error de render' }))
      throw new Error(err.error ?? 'Error de render')
    }
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  },
}

// ===== DISTRIBUTE =====
export const distributeApi = {
  sendEmail: (body: DistributeEmailBody) =>
    api.post<{ ok: boolean }>('/api/distribute/email', body),
  scheduleEmail: (body: ScheduleEmailBody) =>
    api.post<{ ok: boolean; id: number }>('/api/distribute/email/schedule', body),
  getScheduledEmails: () =>
    api.get<ScheduledEmailResponse[]>('/api/distribute/email/scheduled'),
  deleteScheduledEmail: (id: number) =>
    api.delete<{ ok: boolean }>(`/api/distribute/email/scheduled/${id}`),

  publishIg: (body: DistributeIgBody) =>
    api.post<{ ok: boolean; postUrl: string }>('/api/distribute/ig', body),
  scheduleIg: (body: ScheduleIgBody) =>
    api.post<{ ok: boolean; id: number }>('/api/distribute/ig/schedule', body),
  getScheduledIg: () =>
    api.get<ScheduledIgResponse[]>('/api/distribute/ig/scheduled'),
  deleteScheduledIg: (id: number) =>
    api.delete<{ ok: boolean }>(`/api/distribute/ig/scheduled/${id}`),
}

// ===== EXPORT =====
export const exportApi = {
  export: (body: ExportBody, filename: string) =>
    api.download('/api/export', body, filename),
}

// ===== LINKS =====
export const linksApi = {
  list: () => api.get<LinkResponse[]>('/api/links'),
  create: (body: CreateLinkBody) =>
    api.post<{ ok: boolean; slug: string; name: string }>('/api/links', body),
  update: (id: number, body: UpdateLinkBody) =>
    api.put<{ ok: boolean }>(`/api/links/${id}`, body),
  delete: (id: number) => api.delete<{ ok: boolean }>(`/api/links/${id}`),
  publish: (id: number, pages: RenderPage[]) =>
    api.post<{ ok: boolean; url: string }>(`/api/links/${id}/publish`, { pages }),
}

// ===== SETTINGS =====
export const settingsApi = {
  get: () => api.get<SettingsResponse>('/api/settings'),
  update: (body: UpdateSettingsBody) => api.patch<{ ok: boolean }>('/api/settings', body),
}

// ===== INSTAGRAM =====
export const instagramApi = {
  status: () => api.get<IgStatusResponse>('/api/instagram/status'),
  connect: () => { window.location.href = '/api/instagram/connect' },
  disconnect: () => api.delete<{ ok: boolean }>('/api/instagram/disconnect'),
}
