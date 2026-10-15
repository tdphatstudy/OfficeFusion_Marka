import { formatDocumentToHtml, formatDocumentToText } from '@/lib/utils/export'
import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'

let exporting = false

export async function exportDocument(format: 'pdf' | 'html' | 'txt'): Promise<void> {
  if (exporting) {
    return
  }
  exporting = true
  const { content, fileName } = useEditorStore.getState()
  try {
    let path: string | null
    if (format === 'txt') {
      path = await window.api.exportTxt(formatDocumentToText(content))
    } else {
      const { renderMarkdown } = await import('@/lib/preview')
      const html = formatDocumentToHtml(fileName, renderMarkdown(content, 'mathml'))
      path = await (format === 'pdf' ? window.api.exportPdf(html) : window.api.exportHtml(html))
    }
    if (path) {
      useUIStore.getState().notify(`Exported ${format.toUpperCase()} to ${path}`)
    }
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : 'Please try again.'
    useUIStore.getState().notify(`Export failed: ${reason}`, true)
  } finally {
    exporting = false
  }
}
