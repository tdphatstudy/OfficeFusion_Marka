import { useEffect, useState } from 'react'
import {
  loadRecovery,
  recoveryChoices,
  discardRecovery,
  saveRecovery,
  recoverySession,
  type RecoveryChoice
} from '@/lib/recovery'
import { readDraft, draftKey, type Draft } from '@/lib/draft'
import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'

function restore(draft: Draft): void {
  const state = useEditorStore.getState()
  state.openFile(draft.filePath ?? 'Untitled.md', draft.content, draft.location)
  useEditorStore.setState({
    savedContent: draft.savedContent,
    filePath: draft.filePath,
    fileLocation:
      draft.location ?? (draft.filePath ? { kind: 'local', path: draft.filePath } : null),
    isDirty: true,
    recovered: true
  })
}

export function useRecoveryStartup(): {
  ready: boolean
  choices: RecoveryChoice[]
  recover: (id: string) => Promise<void>
  discard: (id: string) => Promise<void>
  dismiss: () => void
} {
  const [ready, setReady] = useState(false)
  const [choices, setChoices] = useState<RecoveryChoice[]>([])
  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const draft = await loadRecovery()
        if (!active) {
          return
        }
        if (draft) {
          restore(draft)
        } else {
          const legacy = readDraft()
          if (legacy) {
            restore(legacy)
            await saveRecovery(legacy)
            localStorage.removeItem(draftKey)
          } else {
            setChoices((await recoveryChoices()).filter(choice => choice.id !== recoverySession()))
          }
        }
      } catch {
        useUIStore.getState().notify('Recovery storage is unavailable. Save to keep changes.', true)
      } finally {
        if (active) {
          setReady(true)
        }
      }
    })()
    return () => {
      active = false
    }
  }, [])
  return {
    ready,
    choices,
    dismiss: () => setChoices([]),
    recover: async id => {
      try {
        const draft = await loadRecovery(id)
        if (draft) {
          restore(draft)
          await saveRecovery(draft)
        }
        setChoices([])
      } catch {
        useUIStore
          .getState()
          .notify('Draft could not be restored. Its original recovery record is retained.', true)
      }
    },
    discard: async id => {
      try {
        await discardRecovery(id)
        setChoices((await recoveryChoices()).filter(choice => choice.id !== recoverySession()))
      } catch {
        useUIStore.getState().notify('Draft could not be discarded. Please try again.', true)
      }
    }
  }
}
