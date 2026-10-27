import { create } from 'zustand'

type HistoryAction = 'undo' | 'redo'

export const useEditorHistoryStore = create(() => ({ canUndo: false, canRedo: false }))

export function publishEditorHistory(canUndo: boolean, canRedo: boolean): void {
  const current = useEditorHistoryStore.getState()
  if (current.canUndo !== canUndo || current.canRedo !== canRedo) {
    useEditorHistoryStore.setState({ canUndo, canRedo })
  }
}

export function runEditorHistory(action: HistoryAction): void {
  window.dispatchEvent(new CustomEvent('marka:history', { detail: action }))
}

export function subscribeEditorHistory(handler: (action: HistoryAction) => void): () => void {
  const listener = (event: Event): void => {
    if (!(event instanceof CustomEvent)) {
      return
    }
    const detail: unknown = event.detail
    if (detail === 'undo' || detail === 'redo') {
      handler(detail)
    }
  }
  window.addEventListener('marka:history', listener)
  return () => window.removeEventListener('marka:history', listener)
}
