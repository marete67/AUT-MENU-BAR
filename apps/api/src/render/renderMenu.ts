import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas'
import type { SKRSContext2D } from '@napi-rs/canvas'
import path from 'node:path'
import fs from 'node:fs'
import https from 'node:https'
import type { RenderPage } from '@menu-bar/shared'

const STORAGE_DIR = path.resolve(process.env['STORAGE_DIR'] ?? path.join(process.cwd(), 'storage'))
const FONT_CACHE_DIR = path.join(STORAGE_DIR, 'fonts', 'cache')

if (!fs.existsSync(FONT_CACHE_DIR)) fs.mkdirSync(FONT_CACHE_DIR, { recursive: true })

const _fontCache = new Set<string>()

const FORMATOS = {
  story: { width: 1080, height: 1920 },
  folio: { width: 2480, height: 3508 },
} as const

// ===== HTTP HELPERS =====
function httpsText(url: string, headers: Record<string, string> = {}, redirects = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    https
      .get({ hostname: u.hostname, path: u.pathname + u.search, headers }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
          return resolve(httpsText(res.headers.location, headers, redirects - 1))
        }
        let d = ''
        res.on('data', (c: Buffer) => (d += c.toString()))
        res.on('end', () => resolve(d))
      })
      .on('error', reject)
  })
}

function httpsDownload(url: string, dest: string, redirects = 5): Promise<void> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    https
      .get({ hostname: u.hostname, path: u.pathname + u.search }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && redirects > 0) {
          return resolve(httpsDownload(res.headers.location, dest, redirects - 1))
        }
        const file = fs.createWriteStream(dest)
        res.pipe(file)
        file.on('finish', () => { file.close(); resolve() })
        file.on('error', (err) => { fs.unlink(dest, () => {}); reject(err) })
      })
      .on('error', (err) => { fs.unlink(dest, () => {}); reject(err) })
  })
}

async function resolveFont(family: string): Promise<string> {
  family = (family || 'Open Sans').trim()
  if (_fontCache.has(family)) return family

  const fileName = family.replace(/\s+/g, '_')
  const ttfPath = path.join(FONT_CACHE_DIR, fileName + '.ttf')

  // Validar cache: comprobar magic bytes TTF/OTF
  if (fs.existsSync(ttfPath)) {
    const buf = Buffer.alloc(4)
    const fd = fs.openSync(ttfPath, 'r')
    fs.readSync(fd, buf, 0, 4, 0)
    fs.closeSync(fd)
    const sig = buf.toString('hex')
    const valid = sig === '00010000' || sig === '74727565' || sig === '4f54544f'
    if (!valid) {
      fs.unlinkSync(ttfPath)
    }
  }

  if (!fs.existsSync(ttfPath)) {
    const cssUrl = `https://fonts.googleapis.com/css?family=${encodeURIComponent(family)}&subset=latin`
    const css = await httpsText(cssUrl, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0',
    })
    const match = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/i)
    if (!match?.[1]) throw new Error(`Fuente no encontrada: ${family}`)
    await httpsDownload(match[1], ttfPath)
  }

  GlobalFonts.registerFromPath(ttfPath, family)
  _fontCache.add(family)
  return family
}

// ===== TEXT RENDERING =====
function measureWithSpacing(ctx: SKRSContext2D, text: string, spacing: number): number {
  let w = 0
  for (const char of text) w += ctx.measureText(char).width + spacing
  return w - spacing
}

function drawWithSpacing(ctx: SKRSContext2D, text: string, x: number, y: number, spacing: number): void {
  let cur = x
  for (const char of text) {
    ctx.fillText(char, cur, y)
    cur += ctx.measureText(char).width + spacing
  }
}

function drawLine(
  ctx: SKRSContext2D,
  text: string,
  blockX: number,
  blockW: number,
  y: number,
  spacing: number,
  align: 'left' | 'center' | 'right',
): void {
  const textWidth = measureWithSpacing(ctx, text, spacing)
  const scaleX = textWidth > blockW ? blockW / textWidth : 1

  ctx.save()
  if (align === 'left') {
    ctx.translate(blockX, y)
    ctx.scale(scaleX, 1)
    drawWithSpacing(ctx, text, 0, 0, spacing)
  } else if (align === 'center') {
    ctx.translate(blockX + blockW / 2, y)
    ctx.scale(scaleX, 1)
    drawWithSpacing(ctx, text, -textWidth / 2, 0, spacing)
  } else {
    ctx.translate(blockX + blockW, y)
    ctx.scale(scaleX, 1)
    drawWithSpacing(ctx, text, -textWidth, 0, spacing)
  }
  ctx.restore()
}

// ===== RENDER PRINCIPAL =====
export async function renderMenu(data: RenderPage): Promise<Buffer> {
  if (!data.fondo_png && !data.fondo_b64) {
    throw new Error('fondo_png o fondo_b64 requerido')
  }

  // Precargar fuentes únicas
  const families = [...new Set(data.blocks.map((b) => b.font_family ?? data.font_family ?? 'Open Sans'))]
  for (const fam of families) await resolveFont(fam)

  const fmt = FORMATOS[data.formato ?? 'story']
  const WIDTH = data.width ?? fmt.width
  const HEIGHT = data.height ?? fmt.height
  const LETTER_SPACING = data.letter_spacing ?? 1.4
  const LINE_HEIGHT = data.line_height_factor ?? 1.4

  const canvas = createCanvas(WIDTH, HEIGHT)
  const ctx = canvas.getContext('2d')
  ctx.textBaseline = 'top'

  // Fondo con comportamiento "cover"
  const fondoSrc = data.fondo_b64
    ? Buffer.from(data.fondo_b64, 'base64')
    : path.join(path.resolve(process.env['ASSETS_DIR'] ?? path.join(process.cwd(), 'assets')), data.fondo_png!)

  const img = await loadImage(fondoSrc)
  const scale = Math.max(WIDTH / img.width, HEIGHT / img.height)
  const scaledW = img.width * scale
  const scaledH = img.height * scale
  ctx.drawImage(img, (WIDTH - scaledW) / 2, (HEIGHT - scaledH) / 2, scaledW, scaledH)

  // Bloques de texto
  for (const block of data.blocks) {
    const raw = block.content ?? ''
    const lines = (
      Array.isArray(raw)
        ? raw
        : String(raw).split('\n')
    ).filter((l) => l.trim())

    if (!lines.length) continue

    const fontSize = Number(block.font_size) || 30
    const family = block.font_family ?? data.font_family ?? 'Open Sans'
    const spacing = block.letter_spacing ?? LETTER_SPACING

    ctx.font = `${fontSize}px "${family}"`
    ctx.fillStyle = block.text_color ?? data.text_color ?? '#000'

    let y = Number(block.y) || 0
    for (const line of lines) {
      drawLine(
        ctx,
        line,
        Number(block.x) || 0,
        Number(block.w) || 100,
        y,
        spacing,
        block.align ?? 'right',
      )
      y += fontSize * (block.line_height_factor ?? LINE_HEIGHT)
    }
  }

  if (data.output_format === 'jpg' || data.output_format === 'jpeg') {
    return canvas.encode('jpeg')
  }
  return canvas.toBuffer('image/png' as 'image/jpeg')
}
