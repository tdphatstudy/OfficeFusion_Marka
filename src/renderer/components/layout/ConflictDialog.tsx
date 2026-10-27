import { useEffect, useState, type FC } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useUIStore } from '@/stores/uiStore'
import { useEditorStore } from '@/stores/editorStore'
import { fileActions } from '@/lib/fileActions'

export const ConflictDialog: FC = () => {
  const conflict = useUIStore(state => state.conflictDocumentId)
  const documentId = useEditorStore(state => state.documentId)
  const draft = useEditorStore(state => state.content)
  const busy = useUIStore(state => state.fileBusy)
  const [disk, setDisk] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const open = conflict !== null && conflict === documentId
  useEffect(() => {
    setDisk(null)
    setError('')
  }, [conflict, documentId])
  const compare = async (): Promise<void> => {
    const location = useEditorStore.getState().fileLocation
    if (!location) {
      return
    }
    setLoading(true)
    setError('')
    try {
      setDisk((await window.api.inspectDocument(location, false)).content)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Could not read the saved file.')
    } finally {
      setLoading(false)
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={value => {
        if (!value && !busy) {
          useUIStore.setState({ conflictDocumentId: null })
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content top-[8%] flex max-h-[84vh] max-w-4xl flex-col overflow-hidden p-5">
          <Dialog.Title className="font-semibold">File changed outside Marka</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-text-secondary">
            Your edits are still here. Compare with the current file, save a copy, or reload after
            deciding what to keep.
          </Dialog.Description>
          {disk !== null && (
            <div className="mt-4 grid min-h-0 grid-cols-2 gap-3 overflow-auto">
              <section>
                <h3 className="mb-2 text-xs font-semibold">Your current draft</h3>
                <pre
                  aria-label="Your draft comparison"
                  className="max-h-[45vh] overflow-auto whitespace-pre-wrap rounded border border-border p-3 text-xs"
                >
                  {draft.slice(0, 128 * 1024)}
                </pre>
              </section>
              <section>
                <h3 className="mb-2 text-xs font-semibold">Current saved file</h3>
                <pre
                  aria-label="Saved file comparison"
                  className="max-h-[45vh] overflow-auto whitespace-pre-wrap rounded border border-border p-3 text-xs"
                >
                  {disk.slice(0, 128 * 1024)}
                </pre>
              </section>
            </div>
          )}
          {disk !== null && (disk.length > 128 * 1024 || draft.length > 128 * 1024) && (
            <p className="mt-2 text-xs">Showing the first 128 Ki characters of each version.</p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-xs">
              {error}
            </p>
          )}
          <div className="mt-4 flex shrink-0 flex-wrap justify-end gap-2">
            <button
              className="secondary-action"
              disabled={busy || loading}
              onClick={() => void compare()}
            >
              {loading ? 'Reading…' : 'Compare versions'}
            </button>
            <button
              className="primary-action"
              disabled={busy || loading}
              onClick={() => {
                void fileActions.saveAs().then(() => {
                  if (!useEditorStore.getState().isDirty) {
                    useUIStore.setState({ conflictDocumentId: null })
                  }
                })
              }}
            >
              Save a copy…
            </button>
            <button
              className="secondary-action"
              disabled={busy || loading}
              onClick={() => void fileActions.reload()}
            >
              Reload saved file…
            </button>
            <Dialog.Close className="secondary-action" disabled={busy}>
              Keep editing
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
