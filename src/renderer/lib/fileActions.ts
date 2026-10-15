import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'

let operation: Promise<void> | null = null

async function saveDocument(saveAs = false): Promise<boolean> {
  const snapshot = useEditorStore.getState()
  const path = await window.api.saveFile(
    snapshot.content,
    saveAs ? undefined : (snapshot.filePath ?? undefined)
  )
  if (!path) {
    return false
  }
  useEditorStore.getState().markSaved(path, snapshot.content, snapshot.documentId)
  useUIStore.getState().notify('Document saved')
  return !useEditorStore.getState().isDirty
}

async function confirmReplacement(): Promise<boolean> {
  if (!useEditorStore.getState().isDirty) {
    return true
  }
  const decision = await window.api.confirmUnsavedChanges(useEditorStore.getState().fileName)
  if (decision === 'save') {
    return saveDocument()
  }
  return decision === 'discard'
}

function runOperation(action: () => Promise<void>): Promise<void> {
  if (operation) {
    return operation
  }
  useUIStore.getState().setFileBusy(true)
  operation = action()
    .catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : 'Please try again.'
      useUIStore.getState().notify(`File operation failed: ${reason}`, true)
    })
    .finally(() => {
      operation = null
      useUIStore.getState().setFileBusy(false)
    })
  return operation
}

export const fileActions = {
  open: (): Promise<void> =>
    runOperation(async () => {
      const result = await window.api.openFile()
      if (result && (await confirmReplacement())) {
        useEditorStore.getState().openFile(result.path, result.content)
      }
    }),
  save: (): Promise<void> =>
    runOperation(async () => {
      await saveDocument()
    }),
  saveAs: (): Promise<void> =>
    runOperation(async () => {
      await saveDocument(true)
    }),
  newDocument: (content = ''): Promise<void> =>
    runOperation(async () => {
      if (await confirmReplacement()) {
        useEditorStore.getState().newFile(content)
      }
    }),
  close: (): Promise<void> =>
    runOperation(async () => {
      if (await confirmReplacement()) {
        const state = useEditorStore.getState()
        if (state.isDirty) {
          state.setContent(state.savedContent)
        }
        window.api.confirmClose()
      }
    })
}
