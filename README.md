# PDF 工具箱 (pdfZipper)

一个基于 Vue 3 + Express 5 + TypeScript 的在线 PDF 与图片处理工具箱，部署于 Vercel，无需安装，开箱即用。

**在线体验：** https://pdfzipper.vercel.app

---

## 功能列表

### PDF 工具
| 工具 | 说明 |
|------|------|
| PDF 压缩 | DPI 重渲染（并行）+ 对象流双策略，自动选择最优结果 |
| PDF 合并 | 拖拽排序，支持 A1–A5 / Letter / Legal 统一纸张 |
| PDF 拆分 | 每页单独导出或自定义范围，打包 ZIP 下载 |
| PDF 旋转 | 顺时针/逆时针/180°，支持旋转全部或指定页面 |
| 页面管理 | 删除指定页面 / 提取指定页面为新 PDF，支持范围格式 |
| PDF 比对 | 逐页对比两个 PDF 的文字内容，双栏高亮显示新增/删除差异 |
| 图片转 PDF | 最多 50 张图片，拖拽排序后合成 PDF |
| PDF 转图片 | 每页渲染为 JPG，多页自动打包 ZIP |

### 图文处理
| 工具 | 说明 |
|------|------|
| 二维码生成 | PNG / SVG / JPG，支持颜色、尺寸、容错级别自定义 |
| 二维码识别 | 上传图片自动解析二维码内容 |

### 文本处理
| 工具 | 说明 |
|------|------|
| 哈希散列 | 文本/文件 MD5 · SHA1 · SHA256 · SHA512，Hex / Base64 |
| 文本比较 | 行/词/字符三种 diff 模式，纯客户端 |
| 文本转义 | Unicode ↔ 文本 · Base64 ↔ UTF-8 · URL 编解码，纯客户端 |
| JSON 格式化 | 美化 / 压缩 / Key 排序 / 实时校验，纯客户端 |

### 图片处理
| 工具 | 说明 |
|------|------|
| 图片压缩 | JPG / PNG / WebP，保持原格式，质量可调 |
| 图片格式转换 | JPG ↔ PNG ↔ WebP ↔ AVIF，图片 ↔ Base64 互转 |

---

## 技术栈

- **前端：** Vue 3 + Vue Router + Pinia + Tailwind CSS + TypeScript
- **后端：** Node.js 20 + Express 5 + TypeScript
- **构建：** Vite 6（前端）+ tsx（后端开发/运行）
- **PDF 处理：** pdf-lib · pdfjs-dist@2.16.105
- **图片处理：** sharp · canvas
- **其他：** qrcode · jsqr · archiver · multer · diff
- **部署：** Vercel（Serverless Functions + CDN 静态托管）

---

## 本地运行

```bash
git clone https://github.com/Twiyin0/pdfZipper.git
cd pdfZipper
yarn install
yarn dev        # 同时启动 Express (3013) + Vite dev server
# 或生产模式
yarn build && yarn start
```

---

## 部署到 Vercel

```bash
npm i -g vercel
vercel deploy --prod
```

项目已配置 `vercel.json`：
- `api/index.ts` → Serverless Function（Express app）
- `dist/`（`yarn build` 产物）→ CDN 静态托管
- SPA fallback：所有非 API 请求指向 `index.html`

---

## 项目结构

```
pdfZipper/
├── api/
│   └── index.ts           # Vercel Serverless 入口（re-export Express app）
├── src/
│   ├── server/
│   │   └── index.ts       # Express 应用，所有 API 路由
│   └── client/
│       ├── main.ts
│       ├── App.vue
│       ├── router/        # Vue Router
│       ├── stores/        # Pinia stores
│       ├── components/    # 公共组件（DropZone, ResultBox, Toast...）
│       └── views/         # 页面组件（按分类组织）
├── server.ts              # 本地开发/生产入口
├── vite.config.ts
├── vercel.json
└── package.json
```

---

## License

[Apache License 2.0](LICENSE)
