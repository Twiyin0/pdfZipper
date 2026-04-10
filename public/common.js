/**
 * 公共工具：剪贴板粘贴上传 + Toast 提示
 * 用法：setupPaste(acceptFn, handler)
 *   acceptFn(mimeType) → boolean  决定接受什么类型的文件
 *   handler(file)                 拿到 File 对象后的处理函数
 */

// 在所有 .drop-hint 上自动补充 Ctrl+V 提示
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.drop-hint').forEach(el => {
    if (!el.textContent.includes('Ctrl+V')) {
      el.textContent += ' · Ctrl+V 粘贴';
    }
  });
});

/**
 * 初始化剪贴板粘贴监听
 * @param {(mime:string)=>boolean} acceptFn  接受的 MIME 类型判断
 * @param {(file:File)=>void}      handler   文件处理回调
 */
function setupPaste(acceptFn, handler) {
  document.addEventListener('paste', e => {
    // 在文本输入框内粘贴时不拦截
    if (e.target.matches('textarea, input[type="text"], input[type="search"], [contenteditable="true"]')) return;

    const items = [...(e.clipboardData?.items ?? [])];
    // 查找第一个满足条件的 file item
    const fileItem = items.find(i => i.kind === 'file' && acceptFn(i.type));
    if (!fileItem) return;

    const file = fileItem.getAsFile();
    if (!file) return;

    e.preventDefault();
    handler(file);

    const label = file.name && file.name !== 'image.png'
      ? file.name
      : (file.type.startsWith('image/') ? '剪贴板截图' : '剪贴板文件');
    showToast(`📋 已粘贴：${label}`);
  });
}

/**
 * 从 API 返回的 file 对象触发浏览器下载
 * @param {{ data: string, mime: string, filename: string }} file
 */
function downloadFile(file) {
  if (!file?.data) return;
  const bytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
  const blob  = new Blob([bytes], { type: file.mime });
  const a     = Object.assign(document.createElement('a'), {
    href:     URL.createObjectURL(blob),
    download: file.filename,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}

/**
 * 显示右下角 Toast 提示
 */
function showToast(msg, duration = 2500) {
  document.querySelector('.paste-toast')?.remove();
  const t = document.createElement('div');
  t.className = 'paste-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  // 双帧后触发动画
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  setTimeout(() => {
    t.classList.remove('show');
    setTimeout(() => t.remove(), 300);
  }, duration);
}
