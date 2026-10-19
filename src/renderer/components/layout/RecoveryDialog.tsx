import { useState, type FC } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { loadRecovery, type RecoveryChoice } from '@/lib/recovery'

interface RecoveryDialogProps {
  choices: RecoveryChoice[]
  recover: (id: string) => Promise<void>
  discard: (id: string) => Promise<void>
  dismiss: () => void
}

export const RecoveryDialog: FC<RecoveryDialogProps> = ({ choices, recover, discard, dismiss }) => {
  const [confirmDiscard, setConfirmDiscard] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [preview, setPreview] = useState<{ name: string; content: string } | null>(null)
  return (
    <Dialog.Root
      open={choices.length > 0}
      onOpenChange={open => {
        if (!open && !pending) {
          dismiss()
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[70] max-h-[80vh] w-[min(480px,90vw)] -translate-x-1/2 -translate-y-1/2 overflow-auto rounded border border-border bg-surface p-5 text-text-primary">
          <Dialog.Title className="font-semibold">Recover drafts</Dialog.Title>
          <Dialog.Description className="my-3 text-xs text-text-secondary">
            Restore a copy in this session. Other sessions keep their drafts.
          </Dialog.Description>
          {choices.map(choice => (
            <div key={choice.id} className="my-2 flex items-center gap-2">
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate">{choice.name}</span>
                <span
                  className="block truncate text-xs text-text-secondary"
                  title={choice.location}
                >
                  {choice.location ?? 'Location unavailable for this older draft'}
                </span>
                <time
                  className="block text-xs text-text-secondary"
                  dateTime={new Date(choice.updatedAt).toISOString()}
                >
                  {new Date(choice.updatedAt).toLocaleString()}
                </time>
              </span>
              <button
                className="secondary-action"
                disabled={pending}
                onClick={() => {
                  setPending(true)
                  void loadRecovery(choice.id)
                    .then(draft =>
                      setPreview({
                        name: choice.name,
                        content: draft?.content.slice(0, 32768) ?? 'Draft is no longer available.'
                      })
                    )
                    .catch(() =>
                      setPreview({
                        name: choice.name,
                        content: 'Could not load this draft. Try again.'
                      })
                    )
                    .finally(() => setPending(false))
                }}
              >
                Preview
              </button>
              <button
                className="secondary-action"
                disabled={pending}
                onClick={() => {
                  setPending(true)
                  void recover(choice.id).finally(() => setPending(false))
                }}
              >
                Restore
              </button>
              <button
                className="secondary-action"
                disabled={pending}
                onClick={() => {
                  if (confirmDiscard !== choice.id) {
                    setConfirmDiscard(choice.id)
                  } else {
                    setPending(true)
                    void discard(choice.id).finally(() => {
                      setPending(false)
                      setConfirmDiscard(null)
                    })
                  }
                }}
              >
                {confirmDiscard === choice.id ? 'Confirm discard' : 'Discard'}
              </button>
            </div>
          ))}
          {preview && (
            <section className="my-3">
              <h3 className="text-xs font-semibold">{preview.name} · first 32 Ki characters</h3>
              <pre
                aria-label="Draft preview"
                className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded border border-border p-2 text-xs"
              >
                {preview.content}
              </pre>
            </section>
          )}
          {confirmDiscard && (
            <p role="alert" className="mt-3 text-xs">
              Discard permanently removes this draft. Choose Confirm discard to continue.{' '}
              <button className="underline" onClick={() => setConfirmDiscard(null)}>
                Cancel discard
              </button>
            </p>
          )}
          <Dialog.Close disabled={pending} className="secondary-action mt-3">
            Start without restoring
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
