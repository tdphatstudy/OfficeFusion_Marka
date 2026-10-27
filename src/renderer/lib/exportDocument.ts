import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'
import { flushEditor } from './editorSession'

let exporting = false

export async function exportDocument(format: 'pdf' | 'html' | 'txt'): Promise<void> {
  if (exporting) {
    return
  }
  exporting = true
  flushEditor()
  if (useEditorStore.getState().pagedDocument) {
    exporting = false
    useUIStore.getState().notify('Large files are read-only. Export is unavailable.')
    return
  }
  const { content, fileName } = useEditorStore.getState()
  try {
    let path: string | null
    if (format === 'txt') {
      path = await window.api.exportTxt(content)
    } else {
      path = await (format === 'pdf'
        ? window.api.exportPdf(content, fileName)
        : window.api.exportHtml(content, fileName))
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
