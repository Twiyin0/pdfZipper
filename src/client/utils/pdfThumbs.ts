// 页面缩略图：与服务端 /api/pdf-thumbs 对应的类型与拉取逻辑。
// 缩略图走服务端渲染（pdf.js + canvas），避免把 pdf.js 打进前端主包。

export interface ThumbPage {
  /** 网格内唯一标识 */
  key: string
  /** 原始页码（1-based，指所在文件内的页序） */
  page: number
  /** 缩略图渲染宽度（px），无预览时为占位比例 */
  width: number
  /** 缩略图渲染高度（px） */
  height: number
  /** base64 图片数据，无预览时为空 */
  data?: string
  mime?: string
  /** 分组标识（合并场景为文件 id） */
  group?: string
  /** 附加说明（合并场景为文件名） */
  label?: string
}

/** 缩略图渲染宽度（px） */
export const THUMB_WIDTH = 200
/** 单个文件最多渲染的缩略图数量 */
export const THUMB_PAGE_LIMIT = 100
/**
 * 合并场景下所有文件合计的缩略图预算。
 * 该值过小会让大文档出现大量「无预览」占位格（看起来像预览失败），
 * 需保证单文件多页文档在典型场景下能全部渲染。
 */
export const THUMB_TOTAL_BUDGET = 400
/**
 * 多文件时单个文件至少分到的预览页数。
 * 下限过低同样会产生大量占位格，因此不低于 12。
 */
export const THUMB_MIN_PER_FILE = 12

export interface ThumbResult {
  pageCount: number
  pages: ThumbPage[]
}

/**
 * 拉取 PDF 页面缩略图。
 * 超出 limit 的页返回占位项（无图片），保证页面顺序数组始终覆盖全部页。
 */
export async function fetchThumbnails(
  file: File,
  opts: { limit?: number; group?: string; label?: string } = {},
): Promise<ThumbResult> {
  const limit = Math.min(200, Math.max(1, opts.limit ?? THUMB_PAGE_LIMIT))
  const prefix = opts.group ?? 'p'
  const fd = new FormData()
  fd.append('pdf', file)
  fd.append('limit', String(limit))
  fd.append('maxWidth', String(THUMB_WIDTH))

  const res = await fetch('/api/pdf-thumbs', { method: 'POST', body: fd })
  const data = await res.json()
  if (!data?.success) throw new Error(data?.error || '缩略图生成失败')

  const rendered = new Map<number, ThumbPage>()
  for (const t of (data.pages ?? []) as Array<{ page: number; width: number; height: number; data: string; mime: string }>) {
    rendered.set(t.page, {
      key: `${prefix}-${t.page}`,
      page: t.page,
      width: t.width,
      height: t.height,
      data: t.data,
      mime: t.mime,
      group: opts.group,
      label: opts.label,
    })
  }

  const pageCount: number = data.pageCount ?? rendered.size
  const pages: ThumbPage[] = []
  for (let n = 1; n <= pageCount; n++) {
    pages.push(rendered.get(n) ?? {
      key: `${prefix}-${n}`,
      page: n,
      width: 210,
      height: 297,
      group: opts.group,
      label: opts.label,
    })
  }
  return { pageCount, pages }
}

/** 缩略图 data URL */
export function thumbSrc(p: ThumbPage): string {
  return `data:${p.mime || 'image/jpeg'};base64,${p.data}`
}

/**
 * 解析页码输入（支持 "1, 3, 5-8" 及中文标点），返回 1-based 页码列表。
 * 与服务端 parseRanges 语义保持一致。
 */
export function parsePageList(input: string, total: number): number[] {
  const out = new Set<number>()
  const normalized = input.replace(/[，｜|]/g, ',').replace(/[－—–]/g, '-')
  for (const part of normalized.split(',')) {
    const s = part.trim()
    if (!s) continue
    const m = s.match(/^(\d+)(?:-(\d+))?$/)
    if (!m) continue
    const from = Math.max(1, parseInt(m[1]))
    const to = m[2] ? Math.min(total, parseInt(m[2])) : from
    for (let i = from; i <= to; i++) if (i <= total) out.add(i)
  }
  return [...out].sort((a, b) => a - b)
}
