import PDFDocument from 'pdfkit'
import archiver from 'archiver'
import type { Writable } from 'node:stream'
import type { RenderPage } from '@menu-bar/shared'
import { renderMenu } from '../render/renderMenu.js'
import { AppError } from '../errors/AppError.js'

const EXPORT_DIMS = {
  story: { w: 1080, h: 1920 },
  folio: { w: 2480, h: 3508 },
} as const

export async function exportPdf(pages: RenderPage[], output: Writable): Promise<void> {
  const doc = new PDFDocument({ autoFirstPage: false, compress: true })
  doc.pipe(output)

  for (const page of pages) {
    const pngBuf = await renderMenu({ ...page, output_format: 'png' })
    const dim = EXPORT_DIMS[page.formato ?? 'story']
    doc.addPage({ size: [dim.w, dim.h], margin: 0 })
    doc.image(pngBuf, 0, 0, { width: dim.w, height: dim.h })
  }

  await new Promise<void>((resolve, reject) => {
    output.on('finish', resolve)
    output.on('error', reject)
    doc.end()
  })
}

export async function exportZip(pages: RenderPage[], output: Writable): Promise<void> {
  const archive = archiver('zip', { zlib: { level: 6 } })
  archive.pipe(output)

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    if (!page) continue
    const jpgBuf = await renderMenu({ ...page, output_format: 'jpg' })
    archive.append(jpgBuf, { name: `menu-${String(i + 1).padStart(2, '0')}.jpg` })
  }

  await archive.finalize()

  await new Promise<void>((resolve, reject) => {
    output.on('finish', resolve)
    output.on('error', reject)
    archive.on('error', reject)
  })
}

export async function exportSingle(page: RenderPage): Promise<Buffer> {
  if (!page.fondo_png && !page.fondo_b64) {
    throw AppError.badRequest('Se requiere fondo_png o fondo_b64')
  }
  return renderMenu(page)
}
