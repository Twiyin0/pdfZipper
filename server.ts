import { APP_ENV, isDevelopment, serverHost, serverPort } from './src/server/env'
import app from './src/server/index'

// 绑定 0.0.0.0 / :: 时日志里显示 localhost 更直观
const displayHost =
  !serverHost || serverHost === '0.0.0.0' || serverHost === '::' ? 'localhost' : serverHost

const onListening = () => {
  console.log(`PDF 工具箱已启动 [${APP_ENV}]: http://${displayHost}:${serverPort}`)
  if (isDevelopment) {
    console.log('前端请访问 Vite dev server: http://localhost:5173')
  }
}

if (serverHost) {
  app.listen(serverPort, serverHost, onListening)
} else {
  app.listen(serverPort, onListening)
}
