import { useCallback } from 'react'
import { useEditorStore } from '@/stores/editorStore'

interface FileActions {
  open: () => Promise<void>
  save: () => Promise<void>
  saveAs: () => Promise<void>
}

export function useFileActions(): FileActions {
  const { openFile, markSaved, content } = useEditorStore()

  const open = useCallback(async (): Promise<void> => {
    const result = await window.api.openFile()
    if (!result) {
      return
    }
    openFile(result.path, result.content)
  }, [openFile])

  const save = useCallback(async (): Promise<void> => {
    const { filePath: currentPath } = useEditorStore.getState()
    const savedPath = await window.api.saveFile(content, currentPath ?? undefined)
    if (savedPath) {
      markSaved(savedPath)
    }
  }, [content, markSaved])

  const saveAs = useCallback(async (): Promise<void> => {
    const savedPath = await window.api.saveFile(content)
    if (savedPath) {
      markSaved(savedPath)
    }
  }, [content, markSaved])

  return { open, save, saveAs }
}
