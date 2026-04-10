// 本地开发入口：加载 api/index.js 并监听端口
// Vercel 部署时直接使用 api/index.js（module.exports = app）

const app = require('./api/index');
const PORT = 3013;

app.listen(PORT, () => console.log(`PDF 工具箱已启动: http://localhost:${PORT}`));
