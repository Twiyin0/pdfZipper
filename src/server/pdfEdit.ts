import fs from 'fs'
import path from 'path'
import { PDFDocument, PDFFont, StandardFonts, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { createCanvas } from 'canvas'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')

// 行高 / 下行比例：必须与前端 src/client/utils/pdfText.ts 完全一致，
// 否则提取出的 rect 与服务端重绘的基线会产生偏移。
export const LINE_HEIGHT_RATIO = 1.2
export const DESCENT_RATIO = 0.25

export interface EditRect { x: number; y: number; w: number; h: number }
export interface RGBColor { r: number; g: number; b: number }

export type EditMode = 'replace' | 'delete' | 'insert'

export interface TextEdit {
  /** 0-based 页码 */
  page: number
  /** PDF 用户空间坐标（左下原点、未应用 /Rotate），单位 pt */
  rect: EditRect
  /** 新文字；replace 模式下为空等同于删除 */
  text?: string
  fontSize?: number
  color?: RGBColor
  font?: 'auto' | 'latin' | 'cjk'
  align?: 'left' | 'center' | 'right'
  /** 新文字超出原宽度时自动缩小字号（默认 true） */
  fitToWidth?: boolean
  /** 是否先用背景色盖住原文字（默认 true；insert 模式忽略） */
  cover?: boolean
  coverColor?: RGBColor | 'auto'
  mode?: EditMode
}

export interface ApplyOptions {
  minFontSize?: number
  maxFontSize?: number
}

export interface ApplyResult {
  buffer: Buffer
  pageCount: number
  applied: number
  skipped: number
}

const JOB_LIMIT = 500
const TEXT_LIMIT = 2000
// 任何超出 Latin-1 的字符（中文、日文、全角标点等）都必须使用嵌入字体，
// 标准 Helvetica 只能编码 WinAnsi，遇到这类字符会直接抛错。
const UNICODE_RE = /[^\x00-\xFF]/

const CJK_FONT_PATH = path.join(__dirname, 'assets/fonts/NotoSansSC-Regular.woff')
let cjkFontBytes: Buffer | null = null

function loadCjkFontBytes(): Buffer {
  if (!cjkFontBytes) {
    if (!fs.existsSync(CJK_FONT_PATH)) {
      throw new Error('缺少中文字体 src/server/assets/fonts/NotoSansSC-Regular.woff')
    }
    cjkFontBytes = fs.readFileSync(CJK_FONT_PATH)
  }
  return cjkFontBytes
}

export function hasCjk(text: string): boolean {
  return UNICODE_RE.test(text)
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n)
}

export function normalizeRect(r: unknown): EditRect | null {
  if (!r || typeof r !== 'object') return null
  const { x, y, w, h } = r as Record<string, unknown>
  if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(w) || !isFiniteNumber(h)) return null
  if (w < 0 || h < 0) return null
  return { x, y, w, h }
}

function toRgb(c?: RGBColor) {
  const ch = (n: unknown) => clamp(isFiniteNumber(n) ? n : 0, 0, 1)
  return rgb(ch(c?.r), ch(c?.g), ch(c?.b))
}

const WHITE: RGBColor = { r: 1, g: 1, b: 1 }

/** 把任意输入收敛成可执行的编辑项，非法项计入 skipped */
function normalizeEdits(edits: unknown, pageCount: number) {
  if (!Array.isArray(edits)) return { items: [], skipped: 0 }

  const items: Array<{ page: number; rect: EditRect; text: string; mode: EditMode; raw: TextEdit }> = []
  let skipped = 0

  for (const raw of edits.slice(0, JOB_LIMIT)) {
    const e = raw as TextEdit
    const rect = normalizeRect(e?.rect)
    const page = e?.page
    const mode: EditMode = e?.mode === 'delete' || e?.mode === 'insert' ? e.mode : 'replace'
    const text = typeof e?.text === 'string' ? e.text.slice(0, TEXT_LIMIT) : ''

    if (!rect || !Number.isInteger(page) || page < 0 || page >= pageCount) { skipped++; continue }
    if (mode !== 'delete' && !text) { skipped++; continue }
    if (mode === 'insert' && rect.w < 1 && !text) { skipped++; continue }

    items.push({ page, rect, text, mode, raw: e })
  }

  return { items, skipped: skipped + Math.max(0, edits.length - JOB_LIMIT) }
}

type BackgroundSampler = (pageIndex: number, rect: EditRect) => Promise<RGBColor>

/**
 * 按需渲染页面并统计目标区域的颜色众数，作为覆盖色。
 * 渲染结果按页缓存，同一页多处修改只渲染一次。
 */
async function createBackgroundSampler(pdfBytes: Buffer): Promise<BackgroundSampler> {
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes), verbosity: 0 }).promise
  const cache = new Map<number, {
    canvas: ReturnType<typeof createCanvas>
    viewport: { convertToViewportPoint: (x: number, y: number) => number[] }
  }>()

  const canvasFactory = {
    create: (w: number, h: number) => {
      const canvas = createCanvas(Math.max(1, w), Math.max(1, h))
      return { canvas, context: canvas.getContext('2d') }
    },
    reset() {},
    destroy() {},
  }

  return async (pageIndex, rect) => {
    let entry = cache.get(pageIndex)
    if (!entry) {
      const page = await pdfDoc.getPage(pageIndex + 1)
      const viewport = page.getViewport({ scale: 1 })
      const canvas = createCanvas(
        Math.max(1, Math.ceil(viewport.width)),
        Math.max(1, Math.ceil(viewport.height)),
      )
      await page.render({
        canvasContext: canvas.getContext('2d'),
        viewport,
        canvasFactory,
      }).promise
      entry = { canvas, viewport }
      cache.set(pageIndex, entry)
    }

    const { canvas, viewport } = entry
    const ctx = canvas.getContext('2d')

    // PDF 坐标 -> 屏幕像素（viewport 已包含 /Rotate），外扩 3px 取周边背景
    const [ax, ay] = viewport.convertToViewportPoint(rect.x, rect.y + rect.h)
    const [bx, by] = viewport.convertToViewportPoint(rect.x + rect.w, rect.y)
    const pad = 3
    const left = Math.max(0, Math.floor(Math.min(ax, bx) - pad))
    const top = Math.max(0, Math.floor(Math.min(ay, by) - pad))
    const right = Math.min(canvas.width, Math.ceil(Math.max(ax, bx) + pad))
    const bottom = Math.min(canvas.height, Math.ceil(Math.max(ay, by) + pad))
    const width = right - left
    const height = bottom - top
    if (width < 1 || height < 1) return WHITE

    const { data } = ctx.getImageData(left, top, width, height)
    const buckets = new Map<number, number>()

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 96) continue
      const r = data[i], g = data[i + 1], b = data[i + 2]
      // 跳过接近纯黑的像素（文字笔画），避免把覆盖色采成黑色
      if (r < 40 && g < 40 && b < 40) continue
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }

    if (!buckets.size) return WHITE

    let bestKey = 0
    let bestCount = -1
    for (const [key, count] of buckets) {
      if (count > bestCount) { bestKey = key; bestCount = count }
    }

    return {
      r: ((((bestKey >> 8) & 0xf) * 16) + 8) / 255,
      g: ((((bestKey >> 4) & 0xf) * 16) + 8) / 255,
      b: (((bestKey & 0xf) * 16) + 8) / 255,
    }
  }
}


function pickFont(
  text: string,
  preference: TextEdit['font'],
  latin: PDFFont,
  cjk: PDFFont | null,
): PDFFont {
  if (preference === 'latin') return latin
  if (preference === 'cjk' || hasCjk(text)) {
    if (!cjk) throw new Error('缺少中文字体，无法写入中文')
    return cjk
  }
  return latin
}

/**
 * 把前端的文字修改应用到 PDF：背景覆盖 + 按原基线重绘。
 * 坐标为 PDF 用户空间（未应用 /Rotate），与前端提取结果一致。
 */
export async function applyTextEdits(
  pdfBytes: Buffer,
  edits: unknown,
  options: ApplyOptions = {},
): Promise<ApplyResult> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  doc.registerFontkit(fontkit)

  const pageCount = doc.getPageCount()
  const normalized = normalizeEdits(edits, pageCount)
  const items = normalized.items
  let skipped = normalized.skipped

  if (!items.length) {
    const buffer = Buffer.from(await doc.save({ useObjectStreams: true }))
    return { buffer, pageCount, applied: 0, skipped }
  }

  const minFontSize = clamp(options.minFontSize ?? 6, 1, 200)
  const maxFontSize = clamp(options.maxFontSize ?? 72, 1, 200)

  const latinFont = await doc.embedFont(StandardFonts.Helvetica)
  const needCjk = items.some((item) => hasCjk(item.text))
  const cjkFont = needCjk ? await doc.embedFont(loadCjkFontBytes(), { subset: true }) : null

  const needSampler = items.some(
    (item) => item.mode !== 'insert' && item.raw.cover !== false && item.raw.coverColor === 'auto',
  )
  const sampler = needSampler ? await createBackgroundSampler(pdfBytes) : null

  let applied = 0

  for (const item of items) {
    const { rect, text, mode, raw } = item
    const page = doc.getPage(item.page)
    const baselineY = rect.y + rect.h * (DESCENT_RATIO / LINE_HEIGHT_RATIO)

    // 先算字体与排版；失败就跳过，避免原文被盖住却没有新文字
    let font: PDFFont | null = null
    let size = 0
    let drawX = rect.x

    if (mode !== 'delete') {
      try {
        const baseSize = clamp(raw.fontSize ?? 12, 1, 200)
        const picked = pickFont(text, raw.font, latinFont, cjkFont)
        size = baseSize

        if (raw.fitToWidth !== false && rect.w > 0) {
          const natural = picked.widthOfTextAtSize(text, baseSize)
          if (natural > rect.w) {
            size = clamp((baseSize * rect.w) / natural, minFontSize, maxFontSize)
          }
        }

        const textWidth = picked.widthOfTextAtSize(text, size)
        if (raw.align === 'center') drawX += (rect.w - textWidth) / 2
        else if (raw.align === 'right') drawX += rect.w - textWidth

        font = picked
      } catch {
        skipped++
        continue
      }
    }

    // 1) 用背景色盖住原文（insert 模式不覆盖）
    if (mode !== 'insert' && raw.cover !== false) {
      const cover = raw.coverColor === 'auto' && sampler
        ? await sampler(item.page, rect)
        : (raw.coverColor && raw.coverColor !== 'auto' ? raw.coverColor : WHITE)

      page.drawRectangle({
        x: rect.x,
        y: rect.y,
        width: Math.max(rect.w, 1),
        height: Math.max(rect.h, 1),
        color: toRgb(cover),
      })
    }

    if (mode === 'delete') { applied++; continue }
    if (!font) { skipped++; continue }

    // 2) 在原基线上绘制新文字
    page.drawText(text, {
      x: drawX,
      y: baselineY,
      size,
      font,
      color: toRgb(raw.color),
    })

    applied++
  }

  const buffer = Buffer.from(await doc.save({ useObjectStreams: true }))
  return { buffer, pageCount, applied, skipped }
}

