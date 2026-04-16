export interface B64File {
  data: string
  mime: string
  filename: string
}

export function downloadFile(file: B64File | null | undefined) {
  if (!file?.data) return
  const bytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0))
  const blob = new Blob([bytes], { type: file.mime })
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: file.filename,
  })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(a.href), 60000)
}

export function fmtSize(b: number): string {
  if (b < 1024) return b + ' B'
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'
  return (b / 1048576).toFixed(2) + ' MB'
}
