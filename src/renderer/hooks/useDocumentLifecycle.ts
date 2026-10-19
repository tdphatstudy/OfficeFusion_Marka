import { useEffect } from 'react'
import { fileActions } from '@/lib/fileActions'
import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'
import { registerRecoveryFlush, saveRecovery } from '@/lib/recovery'
import { flushEditor } from '@/lib/editorSession'
import { createCheckpoint } from '@/lib/checkpoint'

export function useDocumentLifecycle(): void {
  useEffect(() => {
    let storageFailed = false
    const checkpoint = createCheckpoint(() => {
      void flush()
    })
    const flush = async (): Promise<void> => {
      checkpoint.reset()
      flushEditor()
      const { content, savedContent, filePath, fileLocation, isDirty, pagedDocument } =
        useEditorStore.getState()
      try {
        await saveRecovery(
          isDirty && !pagedDocument
            ? { content, savedContent, filePath, location: fileLocation ?? undefined }
            : null
        )
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
    const unregister = registerRecoveryFlush(flush)
    const unsubscribe = useEditorStore.subscribe((state, previous) => {
      const previousReader = previous.pagedDocument?.handle
      if (previousReader && previousReader !== state.pagedDocument?.handle) {
        void window.api.closeReader(previousReader).catch(() => undefined)
      }
      if (
        state.content === previous.content &&
        state.isDirty === previous.isDirty &&
        state.fileLocation === previous.fileLocation &&
        state.documentId === previous.documentId
      ) {
        return
      }
      checkpoint.schedule(state.documentId !== previous.documentId || !state.isDirty)
    })
    const removeCloseListener = window.api.onCloseRequested(() => {
      void fileActions.close()
    })
    const unload = (): void => {
      void flush()
    }
    window.addEventListener('beforeunload', unload)
    return () => {
      checkpoint.reset()
      unsubscribe()
      unregister()
      removeCloseListener()
      window.removeEventListener('beforeunload', unload)
    }
  }, [])
}
