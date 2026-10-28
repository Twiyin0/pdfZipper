import path from 'path'

export type AppEnv = 'development' | 'production'

const ENV_FLAG = '--app-env='
const DEFAULT_PORT = 3013

/**
 * 读取启动参数，支持 `--name=value` 与 `--name value` 两种写法。
 * 缺少取值（下一个 token 仍是 `--xxx`）时返回 undefined。
 */
function readArg(name: string): string | undefined {
  const args = process.argv.slice(2)

  const inline = args.find((arg) => arg.startsWith(`--${name}=`))
  if (inline) return inline.slice(name.length + 3)

  const index = args.indexOf(`--${name}`)
  if (index === -1) return undefined

  const value = args[index + 1]
  return value && !value.startsWith('--') ? value : undefined
}

function fail(message: string): never {
  console.error(`[server] ${message}`)
  process.exit(1)
}

function resolveAppEnv(): AppEnv {
  // 1) 脚本显式传入：yarn dev -> --app-env=development，yarn start -> --app-env=production
  const flagValue = process.argv
    .slice(2)
    .find((arg) => arg.startsWith(ENV_FLAG))
    ?.slice(ENV_FLAG.length)

  if (flagValue === 'production' || flagValue === 'development') return flagValue

  // 2) 回退到标准 NODE_ENV（容器/CI 直接注入时生效）
  if (process.env.NODE_ENV === 'production') return 'production'

  // 3) 默认开发环境
  return 'development'
}

export const APP_ENV: AppEnv = resolveAppEnv()

// 先于其它模块写入，保证 express/sharp 等在加载时读到正确的 NODE_ENV
process.env.NODE_ENV = APP_ENV

export const isProduction = APP_ENV === 'production'
export const isDevelopment = !isProduction

// 前端构建产物目录：
// - production（yarn start）：托管 `vite build` 产物
// - development（yarn dev）：不使用该目录，前端由 Vite dev server(5173) 提供
// 可通过 DIST_DIR 覆盖，便于自定义部署布局。
export const distPath = process.env.DIST_DIR
  ? path.resolve(process.env.DIST_DIR)
  : path.resolve(__dirname, '../../dist')

// ── 启动监听参数 ──────────────────────────────────────────────────────────────
// 优先级：--port / --host > PORT / HOST 环境变量 > 默认值
// 默认绑定所有网卡（不传 host），保持与之前 `app.listen(PORT)` 一致的行为。

function resolveServerPort(): number {
  const raw = readArg('port') ?? process.env.PORT
  if (raw === undefined || raw === '') return DEFAULT_PORT

  const port = Number(raw)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail(`无效端口 "${raw}"：--port / PORT 必须是 1-65535 的整数`)
  }
  return port
}

function resolveServerHost(): string | undefined {
  const raw = (readArg('host') ?? process.env.HOST)?.trim()
  return raw ? raw : undefined
}

export const serverPort = resolveServerPort()
export const serverHost = resolveServerHost()

if (isDevelopment && serverPort !== DEFAULT_PORT) {
  console.warn(
    `[server] 开发模式后端端口已改为 ${serverPort}，但 Vite 代理仍指向 ${DEFAULT_PORT}，` +
    '请同步调整 vite.config.ts 的 proxy 目标或改用默认端口',
  )
}

