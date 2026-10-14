export function formatFilePath(filePath: string | null, maxLength = 40): string {
  if (!filePath) {
    return 'Untitled'
  }
  const parts = filePath.replace(/\\/g, '/').split('/')
  const name = parts[parts.length - 1] ?? 'Untitled'
  if (filePath.length <= maxLength) {
    return filePath
  }
  return `…/${name}`
}

export function getFileName(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/')
  const name = parts[parts.length - 1] ?? ''
  return name.replace(/\.[^.]+$/, '')
}

export function getFileExtension(filePath: string): string {
  const match = filePath.match(/\.([^.]+)$/)
  return match?.[1] ? match[1].toLowerCase() : ''
}

export function isMarkdownFile(filePath: string): boolean {
  return ['md', 'mdx', 'markdown', 'mdown', 'mkd'].includes(getFileExtension(filePath))
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
