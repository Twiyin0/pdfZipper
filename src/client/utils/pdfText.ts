import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

// 与后端 src/server/pdfEdit.ts 保持一致，改了要同步
export const LINE_HEIGHT_RATIO = 1.2
export const DESCENT_RATIO = 0.25

export interface PdfRect { x: number; y: number; w: number; h: number }

/** 字体类别：只区分衬线 / 无衬线，用于近似匹配原字体 */
export type FontFamily = 'serif' | 'sans'

export interface PdfTextRun {
  text: string
  rect: PdfRect
  fontSize: number
  fontFamily: FontFamily
}

export interface PdfTextBlock {
  id: string
  page: number
  text: string
  rect: PdfRect
  fontSize: number
  /** 原文字的字体类别（来自 pdfjs styles） */
  fontFamily: FontFamily
  runs: PdfTextRun[]
}

export type PdfDocumentProxy = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>
export type PdfPageProxy = Awaited<ReturnType<PdfDocumentProxy['getPage']>>

interface RawTextItem {
  str: string
  width: number
  height: number
  transform: number[]
  fontName?: string
}

interface RawTextStyle {
  fontFamily?: string
}

/**
 * pdfjs 会把字体归一成 serif / sans-serif / monospace，
 * 这里只取衬线与否，作为匹配内置字体的依据。
 */
function familyOf(fontName: string | undefined, styles: Record<string, RawTextStyle>): FontFamily {
  const raw = fontName ? styles[fontName]?.fontFamily ?? '' : ''
  return /serif/i.test(raw) && !/sans/i.test(raw) ? 'serif' : 'sans'
}

export function loadPdfDocument(data: ArrayBuffer): Promise<PdfDocumentProxy> {
  return pdfjsLib.getDocument({ data }).promise
}

function toRun(item: RawTextItem, styles: Record<string, RawTextStyle>): PdfTextRun {
  const fontSize =
    Math.hypot(item.transform[2], item.transform[3]) || Math.abs(item.transform[3]) || 12

  return {
    text: item.str,
    fontSize,
    fontFamily: familyOf(item.fontName, styles),
    rect: {
      x: item.transform[4],
      y: item.transform[5] - fontSize * DESCENT_RATIO,
      w: item.width,
      h: fontSize * LINE_HEIGHT_RATIO,
    },
  }
}

function baselineOf(run: PdfTextRun): number {
  return run.rect.y + run.fontSize * DESCENT_RATIO
}

/**
 * pdfjs 常把一个视觉行拆成多个 item，这里按基线合并成"行块"，
 * 行块是编辑的最小单位，比按字符点选自然得多。
 */
function mergeRuns(runs: PdfTextRun[], pageIndex: number): PdfTextBlock[] {
  const sorted = [...runs].sort((a, b) => baselineOf(b) - baselineOf(a) || a.rect.x - b.rect.x)
  const lines: PdfTextRun[][] = []

  for (const run of sorted) {
    const base = baselineOf(run)
    const line = lines.find((candidate) => {
      const ref = baselineOf(candidate[0])
      return Math.abs(ref - base) <= Math.max(1, run.fontSize * 0.18)
    })
    if (line) line.push(run)
    else lines.push([run])
  }

  return lines.map((line, index) => {
    line.sort((a, b) => a.rect.x - b.rect.x)

    let text = ''
    for (let i = 0; i < line.length; i++) {
      const run = line[i]
      if (i > 0) {
        const prev = line[i - 1]
        const gap = run.rect.x - (prev.rect.x + prev.rect.w)
        if (gap > Math.min(prev.fontSize, run.fontSize) * 0.28) text += ' '
      }
      text += run.text
    }

    const left = Math.min(...line.map((r) => r.rect.x))
    const right = Math.max(...line.map((r) => r.rect.x + r.rect.w))
    const bottom = Math.min(...line.map((r) => r.rect.y))
    const top = Math.max(...line.map((r) => r.rect.y + r.rect.h))

    const familyCounts = new Map<FontFamily, number>()
    for (const run of line) {
      familyCounts.set(run.fontFamily, (familyCounts.get(run.fontFamily) ?? 0) + 1)
    }
    const fontFamily = [...familyCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]

    return {
      id: `${pageIndex}-${index}`,
      page: pageIndex,
      text,
      fontSize: Math.max(...line.map((r) => r.fontSize)),
      fontFamily,
      rect: { x: left, y: bottom, w: Math.max(right - left, 1), h: Math.max(top - bottom, 1) },
      runs: line,
    }
  }).sort((a, b) => (b.rect.y + b.rect.h) - (a.rect.y + a.rect.h) || a.rect.x - b.rect.x)
}

export async function extractPageBlocks(
  page: PdfPageProxy,
  pageIndex: number,
): Promise<PdfTextBlock[]> {
  const { items, styles } = await page.getTextContent()
  const styleMap = (styles ?? {}) as Record<string, RawTextStyle>
  const runs = (items as RawTextItem[])
    .filter((item) => item.str && item.str.trim())
    .map((item) => toRun(item, styleMap))

  return mergeRuns(runs, pageIndex)
}

/** PDF 坐标 -> 相对页面的 CSS 像素坐标（已考虑 /Rotate 与缩放） */
export function rectToBox(rect: PdfRect, viewport: { convertToViewportPoint: (x: number, y: number) => number[] }) {
  const [ax, ay] = viewport.convertToViewportPoint(rect.x, rect.y + rect.h)
  const [bx, by] = viewport.convertToViewportPoint(rect.x + rect.w, rect.y)
  return {
    left: Math.min(ax, bx),
    top: Math.min(ay, by),
    width: Math.max(Math.abs(bx - ax), 1),
    height: Math.max(Math.abs(by - ay), 1),
  }
}

/** 页面 CSS 像素坐标 -> PDF 坐标 */
export function pointToPdf(
  x: number,
  y: number,
  viewport: { convertToPdfPoint: (x: number, y: number) => number[] },
) {
  const [px, py] = viewport.convertToPdfPoint(x, y)
  return { x: px, y: py }
}
