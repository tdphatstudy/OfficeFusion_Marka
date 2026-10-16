import { useEffect } from 'react'
import { draftKey } from '@/lib/draft'
import { fileActions } from '@/lib/fileActions'
import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'

export function useDocumentLifecycle(): void {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let storageFailed = false
    const flush = (): void => {
      clearTimeout(timer)
      const { content, savedContent, filePath, fileLocation, isDirty } = useEditorStore.getState()
      try {
        if (isDirty) {
          localStorage.setItem(
            draftKey,
            JSON.stringify({ content, savedContent, filePath, location: fileLocation })
          )
        } else {
          localStorage.removeItem(draftKey)
        }
        storageFailed = false
      } catch {
        if (!storageFailed) {
          useUIStore
            .getState()
            .notify('Draft recovery is unavailable. Save your document to keep changes.', true)
          storageFailed = true
        }
      }
    }
    const unsubscribe = useEditorStore.subscribe((state, previous) => {
      if (
        state.content === previous.content &&
        state.isDirty === previous.isDirty &&
        state.fileLocation === previous.fileLocation &&
        state.documentId === previous.documentId
      ) {
        return
      }
      clearTimeout(timer)
      if (state.documentId !== previous.documentId || !state.isDirty) {
        flush()
      } else {
        timer = setTimeout(flush, 600)
      }
    })
    const removeCloseListener = window.api.onCloseRequested(() => {
      void fileActions.close()
    })
    window.addEventListener('beforeunload', flush)
    return () => {
      flush()
      unsubscribe()
      removeCloseListener()
      window.removeEventListener('beforeunload', flush)
    }
  }, [])
}
