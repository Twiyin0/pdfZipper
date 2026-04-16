import app from './src/server/index'

const PORT = 3013

app.listen(PORT, () => {
  console.log(`PDF 工具箱已启动: http://localhost:${PORT}`)
})
