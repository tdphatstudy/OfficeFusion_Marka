import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'
import { useConnectionStore } from '@/stores/connectionStore'
import type { ConnectionTarget, SshCredentials } from '../../shared/connections'
import { flushEditor } from './editorSession'
import { flushRecovery } from './recovery'

let operation: Promise<void> | null = null

async function saveDocument(saveAs = false): Promise<boolean> {
  const snapshot = useEditorStore.getState()
  if (snapshot.pagedDocument) {
    throw new Error('Large files are read-only. Save is unavailable.')
  }
  const remote = !saveAs && snapshot.fileLocation?.kind === 'ssh'
  const path =
    remote && snapshot.fileLocation
      ? await window.api.saveConnectedDocument(
          snapshot.fileLocation,
          snapshot.content,
          snapshot.savedContent
        )
      : await window.api.saveFile(
          snapshot.content,
          saveAs ? undefined : (snapshot.filePath ?? undefined),
          snapshot.savedContent
        )
  if (!path) {
    return false
  }
  flushEditor()
  useEditorStore.getState().markSaved(path, snapshot.content, snapshot.documentId)
  const location = useEditorStore.getState().fileLocation
  if (location) {
    useConnectionStore.getState().remember(location)
  }
  useUIStore.getState().notify(remote ? 'Saved to SSH host' : 'Document saved')
  return !useEditorStore.getState().isDirty
}

async function confirmReplacement(): Promise<boolean> {
  flushEditor()
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
  flushEditor()
  useUIStore.getState().setFileBusy(true)
  operation = action()
    .catch((error: unknown) => {
      const reason = (error instanceof Error ? error.message : 'Please try again.').replace(
        /^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/,
        ''
      )
      if (reason.includes('Connection cancelled')) {
        useUIStore.getState().notify('Connection cancelled')
        return
      }
      useUIStore.getState().notify(`File operation failed: ${reason}`, true)
    })
    .finally(() => {
      operation = null
      useUIStore.getState().setFileBusy(false)
    })
  return operation
}

export const fileActions = {
  reconnectTarget: async (
    target: ConnectionTarget,
    credentials?: SshCredentials
  ): Promise<boolean> => {
    let connected = false
    await runOperation(async () => {
      const snapshot = useEditorStore.getState()
      const result = await window.api.openConnectedDocument(target, credentials)
      if (
        result.path !== snapshot.filePath ||
        snapshot.documentId !== useEditorStore.getState().documentId
      ) {
        throw new Error('Select the current SSH document to reconnect without replacing edits.')
      }
      useEditorStore.setState({ fileLocation: result.location })
      useUIStore.getState().notify('SSH reconnected. Your edits are preserved.')
      connected = true
    })
    return connected
  },
  openTarget: async (target: ConnectionTarget, credentials?: SshCredentials): Promise<boolean> => {
    let opened = false
    await runOperation(async () => {
      let result = await window.api.openConnectedDocument(target, credentials)
      const baseline = useEditorStore.getState().savedContent
      if (await confirmReplacement()) {
        const state = useEditorStore.getState()
        if (baseline !== state.savedContent && !result.paged) {
          result = await window.api.openConnectedDocument(target, credentials)
        }
        if (result.location && result.path) {
          useEditorStore
            .getState()
            .openFile(result.path, result.content, result.location, result.paged)
        } else {
          useEditorStore.getState().newFile(result.content, result.name)
          useUIStore.getState().notify('Imported a copy. Save to choose a local location.')
        }
        useConnectionStore.getState().remember(target)
        opened = true
      }
    })
    return opened
  },
  open: (): Promise<void> =>
    runOperation(async () => {
      let result = await window.api.openFile()
      const baseline = useEditorStore.getState().savedContent
      if (result && (await confirmReplacement())) {
        const state = useEditorStore.getState()
        if (baseline !== state.savedContent && !result.paged) {
          result = await window.api.refreshFile(result.path)
        }
        useEditorStore.getState().openFile(result.path, result.content, undefined, result.paged)
        useConnectionStore.getState().remember({ kind: 'local', path: result.path })
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
        await flushRecovery()
        window.api.confirmClose()
      }
    })
}
