import express from 'express'
import multer from 'multer'
import path from 'path'
import crypto from 'crypto'
import archiver from 'archiver'
import { PDFDocument, degrees } from 'pdf-lib'
import { createCanvas, loadImage } from 'canvas'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import sharp from 'sharp'
import Diff from 'diff'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')
pdfjsLib.GlobalWorkerOptions.workerSrc = false

const app = express()
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ── multer configs ────────────────────────────────────────────────────────────
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype === 'application/pdf' ? cb(null, true) : cb(new Error('只支持 PDF')),
})

const imgUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024, files: 50 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('只支持图片')),
})

const hashUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
})

// 本地生产模式提供前端静态文件（Vercel 由 CDN 直接提供）
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, '../../dist')))
}

// ── helpers ───────────────────────────────────────────────────────────────────
class NodeCanvasFactory {
  create(w: number, h: number) {
    const c = createCanvas(w, h)
    return { canvas: c, context: c.getContext('2d') }
  }
  reset(p: { canvas: ReturnType<typeof createCanvas> }, w: number, h: number) {
    p.canvas.width = w
    p.canvas.height = h
  }
  destroy(p: { canvas: ReturnType<typeof createCanvas> }) {
    p.canvas.width = 0
    p.canvas.height = 0
  }
}

function b64File(buffer: Buffer, mime: string, filename: string) {
  return { data: buffer.toString('base64'), mime, filename }
}

const origName = (f: Express.Multer.File) =>
  Buffer.from(f.originalname, 'latin1').toString('utf8')

async function buildZipBuffer(addFilesFn: (archive: archiver.Archiver) => Promise<void>): Promise<Buffer> {
  const archive = archiver('zip', { zlib: { level: 6 } })
  const chunks: Buffer[] = []
  const done = new Promise<Buffer>((resolve, reject) => {
    archive.on('data', (chunk: Buffer) => chunks.push(chunk))
    archive.on('end', () => resolve(Buffer.concat(chunks)))
    archive.on('error', reject)
  })
  await addFilesFn(archive)
  archive.finalize()
  return done
}

function parseRanges(rangesStr: string, total: number): [number, number][] {
  return rangesStr
    .replace(/[，｜|]/g, ',')   // 中文逗号、竖线 → 英文逗号
    .replace(/[－—–]/g, '-')    // 中文横线 → 英文连字符
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .flatMap(part => {
      const m = part.match(/^(\d+)(?:-(\d+))?$/)
      if (!m) return []
      const s = Math.max(1, +m[1]) - 1
      const e = m[2] ? Math.min(total, +m[2]) - 1 : s
      return s <= e && s < total ? [[s, e] as [number, number]] : []
    })
}

async function imageToEmbeddable(pdf: PDFDocument, fileBuffer: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') return pdf.embedJpg(fileBuffer)
  if (mimeType === 'image/png') return pdf.embedPng(fileBuffer)
  const img = await loadImage(fileBuffer)
  const canvas = createCanvas(img.width, img.height)
  canvas.getContext('2d').drawImage(img, 0, 0)
  return pdf.embedJpg(canvas.toBuffer('image/jpeg', { quality: 0.92 }))
}

// ── API: 压缩 ─────────────────────────────────────────────────────────────────
async function compressByDPI(buf: Buffer, dpi: number, jpegQuality: number): Promise<Buffer> {
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise
  const total = pdfDoc.numPages
  const scale = dpi / 72
  const cf = new NodeCanvasFactory()
  const jpgs = await Promise.all(
    Array.from({ length: total }, async (_: unknown, i: number) => {
      const page = await pdfDoc.getPage(i + 1)
      const vp = page.getViewport({ scale })
      const w = Math.floor(vp.width), h = Math.floor(vp.height)
      const pair = cf.create(w, h)
      await page.render({ canvasContext: pair.context, viewport: vp, canvasFactory: cf }).promise
      const jpg = pair.canvas.toBuffer('image/jpeg', { quality: jpegQuality })
      cf.destroy(pair)
      return { jpg, w, h }
    })
  )
  const outPdf = await PDFDocument.create()
  for (const { jpg, w, h } of jpgs) {
    const img = await outPdf.embedJpg(jpg)
    const op = outPdf.addPage([w, h])
    op.drawImage(img, { x: 0, y: 0, width: w, height: h })
  }
  return Buffer.from(await outPdf.save({ useObjectStreams: true }))
}

async function compressByStream(buf: Buffer, removeMetadata: boolean): Promise<Buffer> {
  const pdf = await PDFDocument.load(buf)
  if (removeMetadata) {
    pdf.setTitle(''); pdf.setAuthor(''); pdf.setSubject('')
    pdf.setKeywords([]); pdf.setProducer(''); pdf.setCreator('')
  }
  return Buffer.from(await pdf.save({ useObjectStreams: true }))
}

const PAPER_SIZES: Record<string, [number, number]> = {
  a5: [420, 595], a4: [595, 842], a3: [842, 1191],
  a2: [1191, 1684], a1: [1684, 2384],
  letter: [612, 792], legal: [612, 1008],
}

// ── Routes ────────────────────────────────────────────────────────────────────
app.post('/api/compress', pdfUpload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传 PDF 文件' })
  try {
    const input = req.file.buffer
    const dpi = Math.min(300, Math.max(72, parseInt(req.body.dpi) || 150))
    const q = Math.min(0.95, Math.max(0.1, parseFloat(req.body.jpegQuality) || 0.8))
    const rmMeta = req.body.removeMetadata !== 'false'
    let out = await compressByDPI(input, dpi, q)
    let method = 'dpi'
    if (out.length >= input.length) {
      const s = await compressByStream(input, rmMeta)
      if (s.length < out.length) { out = s; method = 'stream' }
    }
    const diff = input.length - out.length
    const baseName = origName(req.file).replace(/\.pdf$/i, '')
    res.json({
      success: true,
      originalName: origName(req.file),
      originalSize: input.length, compressedSize: out.length,
      ratio: +((diff / input.length) * 100).toFixed(1),
      saved: diff, method, dpi, jpegQuality: q,
      file: b64File(out, 'application/pdf', `${baseName}_${dpi}dpi.pdf`),
    })
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }) }
})

app.post('/api/merge', pdfUpload.array('pdfs', 20), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: '请至少上传两个 PDF' })
  try {
    const files = req.files as Express.Multer.File[]
    const order = JSON.parse(req.body.order || '[]') as number[]
    const indices = order.length ? order : files.map((_, i) => i)
    const paperSize = (req.body.paperSize || 'original').toLowerCase()
    const targetDims = PAPER_SIZES[paperSize]
    const merged = await PDFDocument.create()
    for (const idx of indices) {
      const src = await PDFDocument.load(files[idx].buffer)
      if (!targetDims) {
        const pages = await merged.copyPages(src, src.getPageIndices())
        pages.forEach(p => merged.addPage(p))
      } else {
        const copiedPages = await merged.copyPages(src, src.getPageIndices())
        for (let i = 0; i < copiedPages.length; i++) {
          const srcPage = copiedPages[i]
          const { width: sw, height: sh } = srcPage.getSize()
          const landscape = sw > sh
          const [pw, ph] = landscape ? [targetDims[1], targetDims[0]] : targetDims
          const scale = Math.min(pw / sw, ph / sh)
          const dw = sw * scale, dh = sh * scale
          const newPage = merged.addPage([pw, ph])

          // Check if page has Contents before embedding
          const pageDict = srcPage.node
          const contents = pageDict.lookup(pageDict.context.obj('Contents'))
          if (contents) {
            const [emb] = await merged.embedPages([srcPage])
            newPage.drawPage(emb, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh })
          }
          // If no contents, keep blank page
        }
      }
    }
    const buf = Buffer.from(await merged.save({ useObjectStreams: true }))
    res.json({
      success: true,
      pageCount: merged.getPageCount(), size: buf.length,
      file: b64File(buf, 'application/pdf', `merged_${indices.length}files.pdf`),
    })
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }) }
})

app.post('/api/pdf-info', pdfUpload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传 PDF 文件' })
  try {
    const doc = await PDFDocument.load(req.file.buffer)
    res.json({ success: true, pageCount: doc.getPageCount() })
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }) }
})

app.post('/api/split', pdfUpload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传 PDF 文件' })
  try {
    const src = await PDFDocument.load(req.file.buffer)
    const total = src.getPageCount()
    const mode = req.body.mode || 'each'
    let segments: [number, number][]
    if (mode === 'each') {
      segments = Array.from({ length: total }, (_, i) => [i, i])
    } else {
      segments = parseRanges(req.body.ranges || '', total)
      if (!segments.length) return res.status(400).json({ error: '无效的页码范围' })
    }
    const pad = String(segments.length).length
    const zipBuf = await buildZipBuffer(async (archive) => {
      for (let i = 0; i < segments.length; i++) {
        const [s, e] = segments[i]
        const out = await PDFDocument.create()
        const pages = await out.copyPages(src, Array.from({ length: e - s + 1 }, (_, j) => s + j))
        pages.forEach(p => out.addPage(p))
        const bytes = await out.save({ useObjectStreams: true })
        archive.append(Buffer.from(bytes), { name: `part_${String(i + 1).padStart(pad, '0')}.pdf` })
      }
    })
    const baseName = origName(req.file).replace(/\.pdf$/i, '')
    res.json({
      success: true, parts: segments.length, totalPages: total,
      file: b64File(zipBuf, 'application/zip', `${baseName}_split.zip`),
    })
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }) }
})

app.post('/api/rotate', pdfUpload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传 PDF 文件' })
  try {
    const angle = parseInt(req.body.angle) || 90
    if (![90, 180, 270, -90, -180, -270].includes(angle))
      return res.status(400).json({ error: '旋转角度必须是 90 的倍数' })
    const pageNums: string | undefined = req.body.pages
    const doc = await PDFDocument.load(req.file.buffer)
    const total = doc.getPageCount()
    let targetIndices: Set<number> | undefined
    if (pageNums) {
      const segs = parseRanges(pageNums, total)
      const set = new Set<number>()
      for (const [s, e] of segs) for (let i = s; i <= e; i++) set.add(i)
      targetIndices = set
    }
    for (let i = 0; i < total; i++) {
      if (targetIndices && !targetIndices.has(i)) continue
      const page = doc.getPage(i)
      const current = page.getRotation().angle
      page.setRotation(degrees((current + angle + 360) % 360))
    }
    const buf = Buffer.from(await doc.save({ useObjectStreams: true }))
    const baseName = origName(req.file).replace(/\.pdf$/i, '')
    res.json({
      success: true, pageCount: total, size: buf.length,
      file: b64File(buf, 'application/pdf', `${baseName}_rotated.pdf`),
    })
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }) }
})

app.post('/api/remove-pages', pdfUpload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传 PDF 文件' })
  try {
    const doc = await PDFDocument.load(req.file.buffer)
    const total = doc.getPageCount()
    const pages: string = req.body.pages
    if (!pages) return res.status(400).json({ error: '请指定要删除的页码' })
    const toRemove = new Set(
      pages.replace(/[，｜|]/g, ',').split(',').map(s => parseInt(s.trim()) - 1).filter(i => i >= 0 && i < total)
    )
    if (toRemove.size === 0) return res.status(400).json({ error: '无有效页码' })
    if (toRemove.size >= total) return res.status(400).json({ error: '不能删除全部页面' })
    for (let i = total - 1; i >= 0; i--) {
      if (toRemove.has(i)) doc.removePage(i)
    }
    const buf = Buffer.from(await doc.save({ useObjectStreams: true }))
    const baseName = origName(req.file).replace(/\.pdf$/i, '')
    res.json({
      success: true,
      originalPages: total, remainingPages: doc.getPageCount(),
      removedPages: toRemove.size, size: buf.length,
      file: b64File(buf, 'application/pdf', `${baseName}_removed.pdf`),
    })
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }) }
})

app.post('/api/extract-pages', pdfUpload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传 PDF 文件' })
  try {
    const src = await PDFDocument.load(req.file.buffer)
    const total = src.getPageCount()
    const pages: string = req.body.pages
    if (!pages) return res.status(400).json({ error: '请指定要提取的页码' })
    const segments = parseRanges(pages, total)
    if (!segments.length) return res.status(400).json({ error: '无有效页码范围' })
    const indices: number[] = []
    for (const [s, e] of segments) for (let i = s; i <= e; i++) indices.push(i)
    const uniqueIndices = [...new Set(indices)].sort((a, b) => a - b)
    const dest = await PDFDocument.create()
    const copied = await dest.copyPages(src, uniqueIndices)
    copied.forEach(p => dest.addPage(p))
    const buf = Buffer.from(await dest.save({ useObjectStreams: true }))
    const baseName = origName(req.file).replace(/\.pdf$/i, '')
    res.json({
      success: true,
      originalPages: total, extractedPages: dest.getPageCount(), size: buf.length,
      file: b64File(buf, 'application/pdf', `${baseName}_extracted.pdf`),
    })
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }) }
})

async function extractPdfTextByPage(buf: Buffer): Promise<{ pages: string[]; total: number }> {
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf), verbosity: 0 }).promise
  const pages: string[] = []
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i)
    const content = await page.getTextContent()
    const lines: string[] = []
    let lastY: number | null = null
    for (const item of content.items as Array<{ str: string; transform: number[] }>) {
      if (!item.str) continue
      const y = Math.round(item.transform[5])
      if (lastY !== null && Math.abs(y - lastY) > 2) lines.push('\n')
      else if (lastY !== null) lines.push(' ')
      lines.push(item.str)
      lastY = y
    }
    pages.push(lines.join('').trim())
  }
  return { pages, total: pdfDoc.numPages }
}

app.post('/api/compare', pdfUpload.array('pdfs', 2), async (req, res) => {
  if (!req.files || (req.files as Express.Multer.File[]).length !== 2)
    return res.status(400).json({ error: '请上传两个 PDF 文件' })
  try {
    const files = req.files as Express.Multer.File[]
    const [a, b] = await Promise.all([
      extractPdfTextByPage(files[0].buffer),
      extractPdfTextByPage(files[1].buffer),
    ])
    const maxPages = Math.max(a.total, b.total)
    const pageResults = []
    let totalAdded = 0, totalRemoved = 0
    for (let i = 0; i < maxPages; i++) {
      const textA = a.pages[i] || ''
      const textB = b.pages[i] || ''
      if (textA === textB) {
        pageResults.push({ page: i + 1, identical: true, changes: [] })
        continue
      }
      const changes = Diff.diffWords(textA, textB)
      let added = 0, removed = 0
      for (const c of changes) {
        if (c.added) added += c.value.length
        if (c.removed) removed += c.value.length
      }
      totalAdded += added
      totalRemoved += removed
      pageResults.push({
        page: i + 1, identical: false,
        onlyInA: !a.pages[i] ? false : !b.pages[i],
        onlyInB: !b.pages[i] ? false : !a.pages[i],
        changes: changes.map(c => ({
          type: c.added ? 'added' : c.removed ? 'removed' : 'equal',
          value: c.value,
        })),
      })
    }
    const changedPages = pageResults.filter(p => !p.identical).length
    res.json({
      success: true,
      fileA: origName(files[0]), fileB: origName(files[1]),
      totalPages: maxPages, pagesA: a.total, pagesB: b.total,
      changedPages, identicalPages: maxPages - changedPages,
      totalAdded, totalRemoved, pages: pageResults,
    })
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }) }
})

app.post('/api/img-to-pdf', imgUpload.array('images', 50), async (req, res) => {
  if (!req.files?.length) return res.status(400).json({ error: '请上传图片' })
  try {
    const files = req.files as Express.Multer.File[]
    const order = JSON.parse(req.body.order || '[]') as number[]
    const indices = order.length ? order : files.map((_, i) => i)
    const pdf = await PDFDocument.create()
    for (const idx of indices) {
      const file = files[idx]
      const img = await imageToEmbeddable(pdf, file.buffer, file.mimetype)
      const { width, height } = img.scale(1)
      const page = pdf.addPage([width, height])
      page.drawImage(img, { x: 0, y: 0, width, height })
    }
    const buf = Buffer.from(await pdf.save({ useObjectStreams: true }))
    res.json({
      success: true, pageCount: pdf.getPageCount(), size: buf.length,
      file: b64File(buf, 'application/pdf', 'images_to_pdf.pdf'),
    })
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }) }
})

app.post('/api/pdf-to-img', pdfUpload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传 PDF 文件' })
  try {
    const dpi = Math.min(300, Math.max(72, parseInt(req.body.dpi) || 150))
    const scale = dpi / 72
    const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(req.file.buffer), verbosity: 0 }).promise
    const total = pdfDoc.numPages
    const cf = new NodeCanvasFactory()
    const base = origName(req.file).replace(/\.pdf$/i, '')
    async function renderPage(n: number): Promise<Buffer> {
      const page = await pdfDoc.getPage(n)
      const vp = page.getViewport({ scale })
      const pair = cf.create(Math.floor(vp.width), Math.floor(vp.height))
      await page.render({ canvasContext: pair.context, viewport: vp, canvasFactory: cf }).promise
      const jpg = pair.canvas.toBuffer('image/jpeg', { quality: 0.88 })
      cf.destroy(pair)
      return jpg
    }
    if (total === 1) {
      const jpg = await renderPage(1)
      return res.json({
        success: true, pageCount: 1, singleImage: true,
        file: b64File(jpg, 'image/jpeg', `${base}_${dpi}dpi.jpg`),
      })
    }
    const pad = String(total).length
    const zipBuf = await buildZipBuffer(async (archive) => {
      for (let n = 1; n <= total; n++) {
        const jpg = await renderPage(n)
        archive.append(jpg, { name: `page_${String(n).padStart(pad, '0')}.jpg` })
      }
    })
    res.json({
      success: true, pageCount: total, singleImage: false,
      file: b64File(zipBuf, 'application/zip', `${base}_${dpi}dpi_images.zip`),
    })
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }) }
})

app.post('/api/qrcode/generate', async (req, res) => {
  const { content, format = 'png', size = 400, errorLevel = 'M', dark = '#000000', light = '#ffffff' } = req.body
  if (!content?.trim()) return res.status(400).json({ error: '请输入内容' })
  const opts = { width: Math.min(1200, Math.max(100, +size || 400)), errorCorrectionLevel: errorLevel, color: { dark, light } }
  const md5Name = crypto.createHash('md5').update(content).digest('hex')
  try {
    if (format === 'svg') {
      const svg = await QRCode.toString(content, { ...opts, type: 'svg' })
      const buf = Buffer.from(svg)
      return res.json({
        success: true,
        file: b64File(buf, 'image/svg+xml', `${md5Name}.svg`),
        preview: `data:image/svg+xml;base64,${buf.toString('base64')}`,
      })
    }
    const pngBuf = await QRCode.toBuffer(content, { ...opts, type: 'png' })
    if (format === 'jpg' || format === 'jpeg') {
      const jpgBuf = await sharp(pngBuf).flatten({ background: light }).jpeg({ quality: 95 }).toBuffer()
      return res.json({
        success: true,
        file: b64File(jpgBuf, 'image/jpeg', `${md5Name}.jpg`),
        preview: `data:image/jpeg;base64,${jpgBuf.toString('base64')}`,
      })
    }
    res.json({
      success: true,
      file: b64File(pngBuf, 'image/png', `${md5Name}.png`),
      preview: `data:image/png;base64,${pngBuf.toString('base64')}`,
    })
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }) }
})

app.post('/api/qrcode/decode', imgUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传图片' })
  try {
    const img = await loadImage(req.file.buffer)
    const canvas = createCanvas(img.width, img.height)
    canvas.getContext('2d').drawImage(img, 0, 0)
    const { data } = canvas.getContext('2d').getImageData(0, 0, img.width, img.height)
    const code = jsQR(data, img.width, img.height)
    code
      ? res.json({ success: true, content: code.data })
      : res.json({ success: false, error: '未识别到二维码，请确认图片清晰且包含完整二维码' })
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }) }
})

app.post('/api/hash', hashUpload.single('file'), (req, res) => {
  try {
    const data = req.file ? req.file.buffer : Buffer.from(req.body.text || '', 'utf-8')
    const fmt = req.body.format === 'base64' ? 'base64' : 'hex'
    const upper = req.body.uppercase === 'true' && fmt === 'hex'
    const result: Record<string, string> = {}
    for (const a of ['md5', 'sha1', 'sha256', 'sha512']) {
      const h = crypto.createHash(a).update(data).digest(fmt as 'hex' | 'base64')
      result[a] = upper ? h.toUpperCase() : h
    }
    res.json({ success: true, result, byteLength: data.length, fmt, upper, filename: req.file ? origName(req.file) : undefined })
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }) }
})

app.post('/api/img-compress', imgUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传图片' })
  try {
    const quality = Math.min(100, Math.max(1, parseInt(req.body.quality) || 80))
    const meta = await sharp(req.file.buffer).metadata()
    const fmt = meta.format
    let outBuf: Buffer, ext: string
    if (fmt === 'png') {
      outBuf = await sharp(req.file.buffer).png({ compressionLevel: Math.round((100 - quality) / 11), palette: quality < 90 }).toBuffer()
      ext = 'png'
    } else if (fmt === 'webp') {
      outBuf = await sharp(req.file.buffer).webp({ quality }).toBuffer()
      ext = 'webp'
    } else {
      outBuf = await sharp(req.file.buffer).jpeg({ quality, progressive: true }).toBuffer()
      ext = 'jpg'
    }
    const mimeMap: Record<string, string> = { png: 'image/png', webp: 'image/webp', jpg: 'image/jpeg' }
    const baseName = origName(req.file).replace(/\.[^.]+$/, '')
    res.json({
      success: true, ext,
      originalSize: req.file.size, compressedSize: outBuf.length,
      ratio: +(((req.file.size - outBuf.length) / req.file.size) * 100).toFixed(1),
      width: meta.width, height: meta.height,
      file: b64File(outBuf, mimeMap[ext], `${baseName}_compressed.${ext}`),
    })
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }) }
})

app.post('/api/img-convert', imgUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传图片' })
  const target = req.body.target || 'png'
  const quality = Math.min(100, Math.max(1, parseInt(req.body.quality) || 85))
  try {
    const extMap: Record<string, string> = { jpeg: 'jpg', jpg: 'jpg', png: 'png', webp: 'webp', avif: 'avif' }
    const mimeMap: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' }
    const ext = extMap[target] || 'png'
    let s = sharp(req.file.buffer)
    if (target === 'png') s = s.png()
    else if (target === 'webp') s = s.webp({ quality })
    else if (target === 'avif') s = s.avif({ quality })
    else s = s.jpeg({ quality, progressive: true })
    const outBuf = await s.toBuffer()
    const baseName = origName(req.file).replace(/\.[^.]+$/, '')
    res.json({
      success: true, ext,
      originalSize: req.file.size, convertedSize: outBuf.length,
      file: b64File(outBuf, mimeMap[ext], `${baseName}.${ext}`),
    })
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }) }
})

app.post('/api/img-from-base64', async (req, res) => {
  const { dataUrl } = req.body
  if (!dataUrl) return res.status(400).json({ error: '请提供 base64 数据' })
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/s)
  if (!m) return res.status(400).json({ error: '格式错误，应为 data:<mime>;base64,<data>' })
  try {
    const buf = Buffer.from(m[2], 'base64')
    const extMap: Record<string, string> = {
      'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
      'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg',
    }
    const ext = extMap[m[1]] || 'png'
    res.json({ success: true, ext, size: buf.length, file: b64File(buf, m[1], `decoded_image.${ext}`) })
  } catch (e: unknown) { res.status(500).json({ error: (e as Error).message }) }
})

// 本地生产模式 SPA fallback（Vercel 由 vercel.json rewrites 处理）
if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  const distPath = path.join(__dirname, '../../dist')
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

export default app
