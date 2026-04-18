import { env } from '../config/env.js'
import { AppError } from '../errors/AppError.js'

const GRAPH = 'https://graph.facebook.com/v19.0'
const MAX_CONTAINER_ATTEMPTS = 10
const CONTAINER_POLL_DELAY_MS = 3000

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  const data = (await res.json()) as T & { error?: { message: string } }
  if (!res.ok) throw new AppError((data as { error?: { message: string } }).error?.message ?? 'Error de Instagram API', 502)
  return data
}

async function graphPost<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { method: 'POST' })
  const data = (await res.json()) as T & { error?: { message: string } }
  if (!res.ok) throw new AppError((data as { error?: { message: string } }).error?.message ?? 'Error de Instagram API', 502)
  return data
}

export function buildOAuthURL(state: string): string {
  if (!env.IG_APP_ID || !env.IG_REDIRECT_URI) {
    throw AppError.internal('Instagram no configurado en el servidor')
  }
  const params = new URLSearchParams({
    client_id: env.IG_APP_ID,
    redirect_uri: env.IG_REDIRECT_URI,
    scope: 'instagram_content_publish,instagram_basic,pages_read_engagement,pages_show_list',
    response_type: 'code',
    state,
  })
  return `https://www.facebook.com/v19.0/dialog/oauth?${params}`
}

export async function exchangeCodeForLongLivedToken(
  code: string,
): Promise<{ accessToken: string; expiresAt: Date }> {
  if (!env.IG_APP_ID || !env.IG_APP_SECRET || !env.IG_REDIRECT_URI) {
    throw AppError.internal('Instagram no configurado en el servidor')
  }

  const short = await graphGet<{ access_token: string }>('/oauth/access_token', {
    client_id: env.IG_APP_ID,
    client_secret: env.IG_APP_SECRET,
    redirect_uri: env.IG_REDIRECT_URI,
    code,
  })

  const long = await graphGet<{ access_token: string; expires_in: number }>(
    '/oauth/access_token',
    {
      grant_type: 'fb_exchange_token',
      client_id: env.IG_APP_ID,
      client_secret: env.IG_APP_SECRET,
      fb_exchange_token: short.access_token,
    },
  )

  const expiresAt = new Date(Date.now() + long.expires_in * 1000)
  return { accessToken: long.access_token, expiresAt }
}

export async function getInstagramBusinessAccount(
  accessToken: string,
): Promise<{ igId: string; igUsername: string }> {
  const pages = await graphGet<{ data: Array<{ id: string; instagram_business_account?: { id: string } }> }>(
    '/me/accounts',
    { fields: 'id,name,instagram_business_account', access_token: accessToken },
  )

  for (const page of pages.data) {
    const igId = page.instagram_business_account?.id
    if (igId) {
      const igData = await graphGet<{ username: string }>(`/${igId}`, {
        fields: 'username',
        access_token: accessToken,
      })
      return { igId, igUsername: igData.username ?? igId }
    }
  }

  throw AppError.badRequest(
    'No se encontró ninguna cuenta de Instagram Business vinculada. ' +
      'Conecta tu cuenta de Instagram Business a una página de Facebook.',
  )
}

async function waitForContainerReady(containerId: string, accessToken: string): Promise<void> {
  for (let i = 0; i < MAX_CONTAINER_ATTEMPTS; i++) {
    await sleep(CONTAINER_POLL_DELAY_MS)

    const status = await graphGet<{ status_code: string }>(`/${containerId}`, {
      fields: 'status_code',
      access_token: accessToken,
    })

    if (status.status_code === 'FINISHED') return
    if (status.status_code === 'ERROR') {
      throw new AppError('El contenedor de media falló en Instagram', 502)
    }
    // IN_PROGRESS → seguir esperando
  }

  throw new AppError(
    `El contenedor no estuvo listo tras ${MAX_CONTAINER_ATTEMPTS} intentos`,
    504,
  )
}

export async function publishStory(
  instagramId: string,
  accessToken: string,
  imageUrl: string,
): Promise<{ mediaId: string; postUrl: string }> {
  // 1. Crear contenedor
  const container = await graphPost<{ id: string }>(`/${instagramId}/media`, {
    image_url: imageUrl,
    media_type: 'IMAGE',
    is_story: 'true',
    access_token: accessToken,
  })

  // 2. Esperar a que el contenedor esté listo (con verificación del estado final)
  await waitForContainerReady(container.id, accessToken)

  // 3. Publicar
  const published = await graphPost<{ id: string }>(`/${instagramId}/media_publish`, {
    creation_id: container.id,
    access_token: accessToken,
  })

  // 4. Obtener permalink
  const media = await graphGet<{ permalink?: string }>(`/${published.id}`, {
    fields: 'permalink',
    access_token: accessToken,
  })

  return {
    mediaId: published.id,
    postUrl: media.permalink ?? 'https://www.instagram.com/',
  }
}
