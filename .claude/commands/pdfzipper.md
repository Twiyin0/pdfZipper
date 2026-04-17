你正在维护一个名为 **PDF 工具箱（pdfzipper）** 的 Node.js Web 应用，所有文件在当前工作目录中。

---

## 项目概况

| 项目 | 说明 |
|------|------|
| 运行端口 | 3013 |
| 启动命令 | `yarn start`（tsx server.ts） |
| 开发模式 | `yarn dev`（concurrently 同时启动 tsx watch + vite） |
| 构建命令 | `yarn build`（vite build → dist/） |
| 主框架 | Vue 3 + Express 5 + TypeScript |
| 包管理器 | yarn 4（node-modules linker） |
| 核心依赖 | pdf-lib · pdfjs-dist@2.16.105 · canvas · archiver · multer · sharp · qrcode · jsqr · diff · vue-router · pinia |

---

## 文件结构

```
pdfzipper/
├── server.ts                  # 本地开发/生产入口（监听 3013 端口）
├── api/
│   └── index.ts               # Vercel Serverless 入口（re-export src/server/index.ts 的 app）
├── src/
│   ├── server/
│   │   └── index.ts           # Express 应用主体，所有 API 路由
│   └── client/
│       ├── main.ts            # Vue 应用入口
│       ├── App.vue            # 根组件（含 Sidebar + RouterView）
│       ├── style.css          # 全局样式（Tailwind base + 自定义）
│       ├── router/
│       │   └── index.ts       # Vue Router 路由表
│       ├── stores/
│       │   └── theme.ts       # Pinia 主题 store（亮/暗模式）
│       ├── utils/
│       │   └── download.ts    # downloadFile(file) 工具函数
│       ├── composables/
│       │   └── useToast.ts    # Toast 提示 composable
│       └── components/        # 公共组件
│           ├── Sidebar.vue    # 侧边导航栏
│           ├── ThemeToggle.vue
│           ├── DropZone.vue   # 文件拖拽/点击上传区域
│           ├── FileItem.vue   # 文件列表项（含删除/排序）
│           ├── ProgressBar.vue
│           ├── ResultBox.vue  # 操作结果展示（含下载按钮）
│           └── Toast.vue
│       └── views/             # 页面组件
│           ├── pdf/
│           │   ├── PdfCompress.vue
│           │   ├── PdfMerge.vue
│           │   ├── PdfSplit.vue
│           │   ├── PdfRotate.vue
│           │   ├── PdfPages.vue
│           │   └── PdfCompare.vue
│           ├── convert/
│           │   ├── ImgToPdf.vue
│           │   └── PdfToImg.vue
│           ├── qrcode/
│           │   └── QrCode.vue
│           ├── text/
│           │   ├── Hash.vue
│           │   ├── TextDiff.vue
│           │   ├── TextEscape.vue
│           │   └── JsonFormat.vue
│           └── image/
│               ├── ImgCompress.vue
│               └── ImgConvert.vue
├── dist/                      # vite build 输出（Vercel 静态托管）
├── vercel.json                # Vercel 部署配置
├── vite.config.ts             # Vite 配置
├── tailwind.config.js         # Tailwind 配置
└── package.json
```

---

## 路由表

| 路径 | 组件 |
|------|------|
| `/` | redirect → `/pdf/compress` |
| `/pdf/compress` | PdfCompress.vue |
| `/pdf/merge` | PdfMerge.vue |
| `/pdf/split` | PdfSplit.vue |
| `/pdf/rotate` | PdfRotate.vue |
| `/pdf/pages` | PdfPages.vue |
| `/pdf/compare` | PdfCompare.vue |
| `/convert/img-to-pdf` | ImgToPdf.vue |
| `/convert/pdf-to-img` | PdfToImg.vue |
| `/qrcode` | QrCode.vue |
| `/text/hash` | Hash.vue |
| `/text/diff` | TextDiff.vue |
| `/text/escape` | TextEscape.vue |
| `/text/json` | JsonFormat.vue |
| `/image/compress` | ImgCompress.vue |
| `/image/convert` | ImgConvert.vue |

---

## API 路由一览

所有路由在 `src/server/index.ts` 中，文件上传使用 `multer`（内存存储）。API 响应统一使用 base64 内联文件对象：

```ts
// 响应中的 file 字段格式
{ data: string (base64), mime: string, filename: string }
// 前端用 src/client/utils/download.ts 的 downloadFile(file) 触发下载
```

### `POST /api/compress`
压缩 PDF，并行渲染所有页面后选最优结果。

| 字段 | 类型 | 说明 |
|------|------|------|
| `pdf` | File | PDF 文件（multipart），最大 200 MB |
| `dpi` | number | 目标 DPI，72~300，默认 150 |
| `jpegQuality` | number | JPEG 质量，0.1~0.95，默认 0.8 |
| `removeMetadata` | boolean | 是否移除元数据，默认 true |

响应：`{ success, originalName, originalSize, compressedSize, ratio, saved, method('dpi'|'stream'), dpi, jpegQuality, file }`

---

### `POST /api/merge`
合并多个 PDF，可统一纸张尺寸。

| 字段 | 类型 | 说明 |
|------|------|------|
| `pdfs` | File[] | 多个 PDF 文件，最多 20 个 |
| `order` | JSON string | 文件索引顺序数组，如 `[2,0,1]` |
| `paperSize` | string | `original`（默认）\| `a5` \| `a4` \| `a3` \| `a2` \| `a1` \| `letter` \| `legal` |

响应：`{ success, pageCount, size, file }`

---

### `POST /api/split`
拆分 PDF，结果打包为 ZIP。

| 字段 | 类型 | 说明 |
|------|------|------|
| `pdf` | File | PDF 文件 |
| `mode` | string | `each`（每页一个）\| `ranges`（自定义范围） |
| `ranges` | string | mode=ranges 时使用，如 `"1-3, 4-5, 7"` |

响应：`{ success, parts, totalPages, file }`

---

### `POST /api/rotate`
旋转 PDF 页面。

| 字段 | 类型 | 说明 |
|------|------|------|
| `pdf` | File | PDF 文件 |
| `angle` | number | 旋转角度：90 / 180 / 270（顺时针） |
| `pages` | string | 可选，指定页码范围如 `"1, 3, 5-8"`，不传则旋转全部 |

响应：`{ success, pageCount, size, file }`

---

### `POST /api/remove-pages`
从 PDF 中删除指定页面。

| 字段 | 类型 | 说明 |
|------|------|------|
| `pdf` | File | PDF 文件 |
| `pages` | string | 要删除的页码，如 `"1, 3, 5-8"`（1-based，支持范围） |

响应：`{ success, originalPages, remainingPages, removedPages, size, file }`

---

### `POST /api/extract-pages`
从 PDF 中提取指定页面为新 PDF。

| 字段 | 类型 | 说明 |
|------|------|------|
| `pdf` | File | PDF 文件 |
| `pages` | string | 要提取的页码，如 `"1-3, 5, 7-9"`（1-based，支持范围） |

响应：`{ success, originalPages, extractedPages, size, file }`

---

### `POST /api/compare`
逐页对比两个 PDF 的文字内容，返回词级 diff 数据。

| 字段 | 类型 | 说明 |
|------|------|------|
| `pdfs` | File[2] | 恰好两个 PDF 文件（pdfs[0]=原始，pdfs[1]=修改后） |

响应：
```ts
{
  success, fileA, fileB,
  totalPages, pagesA, pagesB,
  changedPages, identicalPages,
  totalAdded, totalRemoved,
  pages: [{
    page,          // 1-based 页码
    identical,     // boolean
    onlyInA,       // boolean（B中无此页）
    onlyInB,       // boolean（A中无此页）
    changes: [{ type: 'added'|'removed'|'equal', value: string }]
  }]
}
```

---

### `POST /api/img-to-pdf`
图片转 PDF，多张图片合成一个 PDF。

| 字段 | 类型 | 说明 |
|------|------|------|
| `images` | File[] | 图片文件（最多 50 张，JPEG/PNG 直接嵌入，其他格式经 canvas 转 JPEG） |
| `order` | JSON string | 文件索引顺序数组 |

响应：`{ success, pageCount, size, file }`

---

### `POST /api/pdf-to-img`
PDF 每页渲染为 JPG，单页直接输出 JPG，多页打包 ZIP。

| 字段 | 类型 | 说明 |
|------|------|------|
| `pdf` | File | PDF 文件 |
| `dpi` | number | 输出分辨率，72~300，默认 150 |

响应：`{ success, pageCount, singleImage: boolean, file }`

---

### `POST /api/qrcode/generate`
生成二维码图片。请求体为 JSON。

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `content` | string | — | 要编码的内容（文本/URL） |
| `format` | string | `png` | `png` \| `svg` \| `jpg` |
| `size` | number | 400 | 图片尺寸 px，100~1200 |
| `errorLevel` | string | `M` | `L` / `M` / `Q` / `H` |
| `dark` | string | `#000000` | 前景色 |
| `light` | string | `#ffffff` | 背景色 |

响应：`{ success, file, preview }` （preview 为 data URL）

---

### `POST /api/qrcode/decode`
识别图片中的二维码（multipart 上传）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `image` | File | 图片文件，最大 50 MB |

响应：`{ success, content }` 或 `{ success: false, error }`

---

### `POST /api/hash`
计算哈希散列，同时输出 MD5 / SHA-1 / SHA-256 / SHA-512。

| 字段 | 类型 | 说明 |
|------|------|------|
| `file` | File（可选） | 上传文件，最大 500 MB |
| `text` | string（可选） | 文本输入（file 和 text 二选一） |
| `format` | string | `hex`（默认）\| `base64` |
| `uppercase` | boolean | 是否大写（仅 hex 模式有效） |

响应：`{ success, result: {md5, sha1, sha256, sha512}, byteLength, fmt, upper, filename }`

---

### `POST /api/img-compress`
压缩图片，保持原始格式（JPG/PNG/WebP）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `image` | File | 图片文件，最大 50 MB |
| `quality` | number | 质量 1~100，默认 80 |

响应：`{ success, ext, originalSize, compressedSize, ratio, width, height, file }`

---

### `POST /api/img-convert`
图片格式转换（multipart）。

| 字段 | 类型 | 说明 |
|------|------|------|
| `image` | File | 源图片 |
| `target` | string | `png` \| `jpeg` \| `webp` \| `avif` |
| `quality` | number | 质量 1~100，默认 85（有损格式） |

响应：`{ success, ext, originalSize, convertedSize, file }`

---

### `POST /api/img-from-base64`
将 Base64 data URL 解码保存为图片文件。请求体为 JSON。

| 字段 | 类型 | 说明 |
|------|------|------|
| `dataUrl` | string | `data:<mime>;base64,<data>` 格式 |

响应：`{ success, ext, size, file }`

---

## 关键实现细节

### 压缩逻辑（并行渲染）
```ts
// compressByDPI：Promise.all 并行渲染所有页面，再顺序嵌入 PDF
const jpgs = await Promise.all(
  Array.from({ length: total }, async (_, i) => {
    const page = await pdfDoc.getPage(i + 1);
    // ... render → toBuffer('image/jpeg') ...
  })
);
// 若 DPI 结果 >= 原始大小，自动降级到 compressByStream
```

### 纸张尺寸表（单位：pt，1in=72pt）
```ts
const PAPER_SIZES = {
  a5: [420,595], a4: [595,842], a3: [842,1191],
  a2: [1191,1684], a1: [1684,2384],
  letter: [612,792], legal: [612,1008],
};
```

### Canvas 工厂（pdfjs-dist Node.js 渲染依赖）
```ts
class NodeCanvasFactory {
  create(w: number, h: number) { const c = createCanvas(w, h); return { canvas: c, context: c.getContext('2d') }; }
  reset(p: any, w: number, h: number) { p.canvas.width = w; p.canvas.height = h; }
  destroy(p: any) { p.canvas.width = 0; p.canvas.height = 0; }
}
```
> pdfjs-dist 使用 `@2.16.105`，加载路径 `pdfjs-dist/legacy/build/pdf.js`，Node 环境需设 `workerSrc = null`。

### 前端文件下载（utils/download.ts）
```ts
// 所有 API 响应的 file 字段通过此函数触发下载
downloadFile({ data, mime, filename })
```

### 前端组件约定
- `DropZone.vue`：统一的文件拖拽/点击上传区域，emit `file-selected`
- `ResultBox.vue`：展示操作结果，含下载按钮，接收 `file` prop
- `useToast()`：composable，提供 `showToast(msg, type)` 方法
- `Sidebar.vue`：侧边导航，按分类折叠展示所有工具链接

### multer 配置汇总

| 实例 | 用途 | 大小限制 | 其他 |
|------|------|----------|------|
| `pdfUpload` | PDF 路由 | 200 MB | 仅 application/pdf |
| `imgUpload` | 图片路由 | 50 MB | 仅 image/*，最多 50 个文件 |
| `hashUpload` | 哈希路由 | 500 MB | 任意格式 |

---

## Vercel 部署配置

```json
{
  "builds": [
    { "src": "api/index.ts", "use": "@vercel/node" },
    { "src": "package.json", "use": "@vercel/static-build", "config": { "distDir": "dist" } }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/index.ts" },
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

- `api/index.ts` → Serverless Function（Express app）
- `dist/` → CDN 静态托管（vite build 产物）
- SPA fallback：所有非 API、非静态文件的请求都指向 `index.html`

---

## 添加新工具的步骤

1. **src/server/index.ts** 添加新 API 路由
2. **src/client/views/分类/NewTool.vue** 创建页面组件，使用 `DropZone`、`ResultBox`、`useToast` 等公共组件
3. **src/client/router/index.ts** 添加路由记录
4. **src/client/components/Sidebar.vue** 在对应分类下添加导航链接

---

## 常见任务

- **修改上传大小限制**：`src/server/index.ts` 中对应 `multer` 实例的 `limits.fileSize`
- **添加新纸张尺寸**：`src/server/index.ts` 的 `PAPER_SIZES` 对象 + `PdfMerge.vue` 的尺寸选择 UI
- **调整 PDF 转图片质量**：`/api/pdf-to-img` 路由中 `toBuffer('image/jpeg', { quality: 0.88 })`
- **主题切换**：`src/client/stores/theme.ts`（Pinia store）

---

收到此 skill 后，你已拥有完整的项目上下文。请根据用户的具体需求直接开始工作，无需再次询问项目结构。
