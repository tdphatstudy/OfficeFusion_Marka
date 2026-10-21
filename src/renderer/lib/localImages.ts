import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'
import { fileActions } from './fileActions'

const cache = new Map<string, Promise<string>>()
const waiting: Array<() => void> = []
let active = 0

function scheduleImage(path: string, reference: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const run = (): void => {
      active++
      void window.api
        .loadImage(path, reference)
        .then(resolve, reject)
        .finally(() => {
          active--
          waiting.shift()?.()
        })
    }
    if (active < 2) {
      run()
    } else {
      waiting.push(run)
    }
  })
}

export function loadLocalImage(
  documentId: number,
  documentPath: string,
  reference: string
): Promise<string> {
  const key = `${documentId}\0${documentPath}\0${reference}`
  const existing = cache.get(key)
  if (existing) {
    return existing
  }
  const request = scheduleImage(documentPath, reference).catch((error: unknown) => {
    cache.delete(key)
    throw error
  })
  if (cache.size >= 6) {
    cache.delete(cache.keys().next().value ?? '')
  }
  cache.set(key, request)
  return request
}

export async function chooseLocalImage(): Promise<string | null> {
  let state = useEditorStore.getState()
  if (state.pagedDocument || state.fileLocation?.kind === 'ssh') {
    useUIStore.getState().notify('Local images are available for editable local documents.', true)
    return null
  }
  const id = state.documentId
  if (!state.filePath) {
    await fileActions.save()
    state = useEditorStore.getState()
  }
  if (state.documentId !== id || state.fileLocation?.kind !== 'local' || !state.filePath) {
    return null
  }
  try {
    const reference = await window.api.insertImage(state.filePath)
    if (useEditorStore.getState().documentId !== id) {
      return null
    }
    return reference
  } catch (error: unknown) {
    useUIStore
      .getState()
      .notify(error instanceof Error ? error.message : 'Could not import image.', true)
    return null
  }
}
