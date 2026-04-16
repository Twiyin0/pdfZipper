你正在维护一个名为 **PDF 工具箱（pdfzipper）** 的 Node.js Web 应用，所有文件在当前工作目录中。

---

## 项目概况

| 项目 | 说明 |
|------|------|
| 运行端口 | 3013 |
| 启动命令 | `npm start` 或 `node server.js` |
| 开发模式 | `npm run dev`（node --watch 自动重启） |
| 主框架 | Express 5 |
| 核心依赖 | pdf-lib · pdfjs-dist@2.16.105 · canvas · archiver · multer · sharp · qrcode · jsqr · diff |

---

## 文件结构

```
pdfzipper/
├── server.js              # 本地开发入口（监听 3013 端口）
├── api/
│   └── index.js           # Express 应用主体，所有 API 路由（Vercel Serverless 入口）
├── package.json
├── public/
│   ├── style.css          # 全局共享样式（导航、卡片、按钮、进度、结果组件、toast）
│   ├── common.js          # 公共 JS：剪贴板粘贴上传（setupPaste）+ Toast 提示（showToast）+ downloadFile
│   ├── index.html         # 首页：4 类工具的卡片导航（PDF工具、图文处理、文本处理、图片处理）
│   ├── pdf_compress.html  # PDF 压缩（DPI+质量双滑块，5 预设，自动降级显示）
│   ├── pdf_merge.html     # PDF 合并（拖拽排序，8 种纸张尺寸统一）
│   ├── pdf_split.html     # PDF 拆分（每页/自定义范围，ZIP 下载）
│   ├── pdf_rotate.html    # PDF 旋转（90/180/270°，全部或指定页面）
│   ├── pdf_pages.html     # PDF 页面管理（删除页面 / 提取页面，支持范围格式）
│   ├── pdf_compare.html   # PDF 比对（双栏文字 diff，高亮新增/删除，按页导航）
│   ├── img_to_pdf.html    # 图片转 PDF（缩略图拖拽排序，最多 50 张）
│   ├── pdf_to_img.html    # PDF 转图片（单页→JPG，多页→ZIP）
│   ├── qrcode.html        # 二维码：生成（PNG/SVG/JPG，颜色/尺寸/容错）+ 识别（jsQR）
│   ├── hash.html          # 哈希散列：文本/文件，MD5/SHA1/SHA256/SHA512，十六进制/Base64
│   ├── text_diff.html     # 文本比较：行/词/字符 diff，CDN jsdiff，纯客户端
│   ├── text_escape.html   # 文本转义：Unicode / Base64 / URL 双向互转，纯客户端
│   ├── json_format.html   # JSON 格式化：美化/压缩/Key排序/校验，纯客户端
│   ├── img_compress.html  # 图片压缩：JPG/PNG/WebP，保持格式，质量滑块
│   └── img_convert.html   # 图片格式转换：JPG↔PNG↔WebP↔AVIF，图片↔Base64
├── outputs/               # 临时输出目录（文件 10 分钟后自动删除）
└── .claude/commands/
    └── pdfzipper.md       # 本 skill 文件
```

---

## 工具分类（首页）

| 分类 | 工具 |
|------|------|
| PDF 工具 | 压缩、合并、拆分、旋转、页面管理、PDF比对、图转PDF、PDF转图 |
| 图文处理 | 二维码生成/识别 |
| 文本处理 | 哈希散列、文本比较、文本转义、JSON格式化 |
| 图片处理 | 图片压缩、图片格式转换 |

---

## API 路由一览

所有路由在 `api/index.js` 中，文件上传使用 `multer`（内存存储）。API 响应统一使用 base64 内联文件对象（无需 `/api/download`）：

```js
// 响应中的 file 字段格式
{ data: string (base64), mime: string, filename: string }
// 前端用 common.js 的 downloadFile(file) 触发下载
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
```js
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
```js
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
```js
const PAPER_SIZES = {
  a5: [420,595], a4: [595,842], a3: [842,1191],
  a2: [1191,1684], a1: [1684,2384],
  letter: [612,792], legal: [612,1008],
};
```

### 页面旋转（pdf-lib）
```js
const { degrees } = require('pdf-lib');
page.setRotation(degrees((current + angle + 360) % 360));
```

### 删除页面（倒序避免索引偏移）
```js
for (let i = total - 1; i >= 0; i--) {
  if (removeSet.has(i)) doc.removePage(i);
}
```

### PDF 比对（diff 库）
```js
const Diff = require('diff');
// 提取文字时按 y 坐标分组保留换行结构
const changes = Diff.diffWords(textA, textB);
// changes[i]: { type: 'added'|'removed'|'equal', value }
```

### Canvas 工厂（pdfjs-dist Node.js 渲染依赖）
```js
class NodeCanvasFactory {
  create(w, h) { const c = createCanvas(w, h); return { canvas: c, context: c.getContext('2d') }; }
  reset(p, w, h) { p.canvas.width = w; p.canvas.height = h; }
  destroy(p)    { p.canvas.width = 0; p.canvas.height = 0; }
}
```
> pdfjs-dist 使用 `@2.16.105`，加载路径 `pdfjs-dist/legacy/build/pdf.js`，Node 环境需设 `workerSrc = false`。

### 剪贴板粘贴上传（common.js）
所有上传页面引入 `<script src="/common.js"></script>`，调用：
```js
setupPaste(acceptFn, handler)
// acceptFn(mimeType) → boolean  决定接受什么类型的文件
// handler(file)                 拿到 File 对象后的处理函数
```

各页面配置：

| 页面 | acceptFn | handler |
|------|----------|---------|
| pdf_compress | `t === 'application/pdf'` | `selectFile(f)` |
| pdf_merge | `t === 'application/pdf'` | `addFiles([f])` |
| pdf_split | `t === 'application/pdf'` | `selectFile(f)` |
| pdf_rotate | `t === 'application/pdf'` | `selectFile(f)` |
| pdf_pages | `t === 'application/pdf'` | `selectFile(f)` |
| pdf_compare | `t === 'application/pdf'` | 第1次→slotA，第2次→slotB |
| img_to_pdf | `t.startsWith('image/')` | `addImages([f])` |
| pdf_to_img | `t === 'application/pdf'` | `selectFile(f)` |
| qrcode | `t.startsWith('image/')` | 切换到识别 tab → `setDecFile(f)` |
| hash | `() => true`（任意文件） | 切换到文件 tab → `setFile(f)` |
| img_compress | `t.startsWith('image/')` | `selectFile(f)` |
| img_convert | `t.startsWith('image/')` | 按当前 tab 分发（fmt/enc） |

### 前端拖拽排序（pdf_merge / img_to_pdf）
使用 HTML5 原生 drag API：`dragstart` 记录 `dragSrc` id，`drop` 时对内存数组重排（`splice`），再调用 `render()` 重绘 DOM。

### 纯客户端工具（无服务器调用）
- **text_diff.html**：引入 CDN `jsdiff`，支持行/词/字符三种模式
- **text_escape.html**：Unicode `\uXXXX` ↔ 文本、Base64 ↔ UTF-8 文本、encodeURIComponent ↔ 文本
- **json_format.html**：美化（缩进可选 2/4/Tab）、压缩、Key 排序（递归）、实时校验

---

## multer 配置汇总

| 实例 | 用途 | 大小限制 | 其他 |
|------|------|----------|------|
| `pdfUpload` | PDF 路由 | 200 MB | 仅 application/pdf |
| `imgUpload` | 图片路由 | 50 MB | 仅 image/*，最多 50 个文件 |
| `hashUpload` | 哈希路由 | 500 MB | 任意格式 |

---

## 添加新工具的步骤

1. **api/index.js** 添加新路由（参考现有路由结构）
2. **public/新页面.html** 引入 `/style.css` 和 `/common.js`，复制导航栏结构，设置正确的 `class="active"` 高亮项
3. 若支持文件粘贴上传，在 script 末尾调用 `setupPaste(acceptFn, handler)`
4. **public/index.html** 的对应分类 section 中添加新工具卡片
5. 更新所有相关页面的 `.nav-links`（PDF 工具页面共享同一套导航）

---

## 常见任务

- **修改上传大小限制**：`api/index.js` 中对应 `multer` 实例的 `limits.fileSize`
- **添加新纸张尺寸**：在 `PAPER_SIZES` 对象中追加，并在 `pdf_merge.html` 的 `#sizeGrid` 添加按钮
- **调整 PDF 转图片质量**：`/api/pdf-to-img` 路由中 `toBuffer('image/jpeg', { quality: 0.88 })`
- **Toast 样式**：`style.css` 末尾 `.paste-toast` 类

---

收到此 skill 后，你已拥有完整的项目上下文。请根据用户的具体需求直接开始工作，无需再次询问项目结构。
