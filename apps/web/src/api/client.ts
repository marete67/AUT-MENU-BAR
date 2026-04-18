import { useAuthStore } from '@/stores/auth.store.js'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const auth = useAuthStore()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`
  }

  const res = await fetch(url, { ...options, headers })

  // Token expirado → logout y redirigir
  if (res.status === 401) {
    auth.logout()
    window.location.href = '/login'
    throw new ApiError('Sesión expirada', 401, 'UNAUTHORIZED')
  }

  if (!res.ok) {
    let errorData: { error?: string; code?: string } = {}
    try {
      errorData = await res.json()
    } catch {
      errorData = { error: res.statusText }
    }
    throw new ApiError(errorData.error ?? 'Error desconocido', res.status, errorData.code)
  }

  // Respuestas sin body (204)
  if (res.status === 204) return undefined as unknown as T

  return res.json() as Promise<T>
}

export const api = {
  get: <T>(url: string) => request<T>(url),

  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body) }),

  put: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'PUT', body: JSON.stringify(body) }),

  patch: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: <T>(url: string) => request<T>(url, { method: 'DELETE' }),

  // Para descargas (no JSON)
  download: async (url: string, body?: unknown, filename = 'descarga'): Promise<void> => {
    const auth = useAuthStore()
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Error de descarga' }))
      throw new ApiError(err.error ?? 'Error de descarga', res.status)
    }

    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    a.click()
    URL.revokeObjectURL(objectUrl)
  },
}
