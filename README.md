# PDF 工具箱 (pdfZipper)

一个基于 Node.js + Express 的在线 PDF 与图片处理工具箱，部署于 Vercel，无需安装，开箱即用。

**在线体验：** https://pdfzipper.vercel.app

---

## 功能列表

### PDF 工具
| 工具 | 说明 |
|------|------|
| PDF 压缩 | DPI 重渲染 + 对象流双策略，自动选择最优结果 |
| PDF 合并 | 拖拽排序，支持 A1–A5 / Letter / Legal 统一纸张 |
| PDF 拆分 | 每页单独导出或自定义范围，打包 ZIP 下载 |
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

- **运行时：** Node.js 20 + Express 5
- **PDF 处理：** pdf-lib · pdfjs-dist@2.16.105
- **图片处理：** sharp · canvas
- **其他：** qrcode · jsqr · archiver · multer
- **部署：** Vercel（Serverless Functions + CDN 静态托管）

---

## 本地运行

```bash
git clone https://github.com/Twiyin0/pdfZipper.git
cd pdfZipper
npm install
npm start        # http://localhost:3013
# 或开发模式（文件变更自动重启）
npm run dev
```

---

## 部署到 Vercel

```bash
npm i -g vercel
vercel deploy --prod
```

项目已配置 `vercel.json`，部署后 API 路由自动映射到 Serverless Function，静态页面由 CDN 托管。

---

## 项目结构

```
pdfZipper/
├── api/
│   └── index.js       # Express 应用（Vercel Serverless 入口）
├── public/            # 静态前端页面
├── server.js          # 本地开发入口（监听 3013 端口）
├── vercel.json        # Vercel 部署配置
└── package.json
```

---

## License

[Apache License 2.0](LICENSE)
