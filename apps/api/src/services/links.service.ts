import fs from 'node:fs/promises'
import path from 'node:path'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { publicLinks } from '../db/schema.js'
import type { RenderPage } from '@menu-bar/shared'
import { renderMenu } from '../render/renderMenu.js'
import { AppError } from '../errors/AppError.js'

const STORAGE_DIR = path.resolve(process.env['STORAGE_DIR'] ?? path.join(process.cwd(), 'storage'))
const PUBLIC_PAGES_DIR = path.join(STORAGE_DIR, 'public_pages')

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

export function buildViewerHTML(link: typeof publicLinks.$inferSelect | null): string {
  if (!link || !link.pageCount) {
    const name = link?.name ? escapeHtml(link.name) : ''
    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${name || 'No encontrado'}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#060d24;color:#6b7a99;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;gap:8px}
.logo{font-family:Manrope,sans-serif;font-size:14px;font-weight:700;color:#e8edf8}
.logo span{color:#9effc8}
</style>
</head>
<body>
<div class="logo"><span>[</span> MENU BAR <span>]</span></div>
<p>${name ? `${name} · sin contenido publicado` : 'Menú no encontrado'}</p>
</body>
</html>`
  }

  const safeName = escapeHtml(link.name)
  const images = Array.from(
    { length: link.pageCount },
    (_, i) => `/storage/public_pages/${escapeHtml(link.slug)}/page-${i + 1}.jpg`,
  )

  const updated = link.lastPublishedAt
    ? new Date(link.lastPublishedAt).toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeName}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#060d24;color:#e8edf8;font-family:'Inter',sans-serif;min-height:100vh}
.top{padding:14px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,0.06)}
.logo{font-family:'Manrope',sans-serif;font-size:14px;font-weight:700}
.logo span{color:#9effc8}
.pub-name{font-size:12px;color:#6b7a99;font-family:'Manrope',sans-serif}
.gallery{display:flex;flex-direction:column;align-items:center;gap:20px;padding:28px 16px}
.gallery img{max-width:420px;width:100%;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,0.6)}
.footer{text-align:center;font-size:11px;color:#3d4f6e;padding:0 0 32px}
</style>
</head>
<body>
<div class="top">
  <div class="logo"><span>[</span> MENU BAR <span>]</span></div>
  <div class="pub-name">${safeName}</div>
</div>
<div class="gallery">
  ${images.map((src) => `<img src="${src}" loading="lazy" alt="Menú">`).join('\n  ')}
</div>
<p class="footer">${updated ? `Actualizado ${updated}` : ''}</p>
</body>
</html>`
}

export async function publishLinkPages(
  linkId: number,
  userId: number,
  pages: RenderPage[],
): Promise<string> {
  const [link] = await db
    .select()
    .from(publicLinks)
    .where(and(eq(publicLinks.id, linkId), eq(publicLinks.userId, userId)))
    .limit(1)

  if (!link) throw AppError.notFound('Link no encontrado')

  const dir = path.join(PUBLIC_PAGES_DIR, link.slug)
  await fs.mkdir(dir, { recursive: true })

  // Limpiar páginas anteriores
  const existing = await fs.readdir(dir)
  await Promise.all(existing.map((f) => fs.unlink(path.join(dir, f))))

  // Generar nuevas páginas
  await Promise.all(
    pages.map(async (page, i) => {
      const buf = await renderMenu({ ...page, output_format: 'jpg' })
      await fs.writeFile(path.join(dir, `page-${i + 1}.jpg`), buf)
    }),
  )

  await db
    .update(publicLinks)
    .set({ pageCount: pages.length, lastPublishedAt: new Date() })
    .where(eq(publicLinks.id, linkId))

  return link.slug
}

export async function deleteLinkStorage(slug: string): Promise<void> {
  const dir = path.join(PUBLIC_PAGES_DIR, slug)
  await fs.rm(dir, { recursive: true, force: true })
}
