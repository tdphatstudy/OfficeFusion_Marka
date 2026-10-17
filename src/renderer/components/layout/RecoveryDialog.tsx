import type { FC } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import type { RecoveryChoice } from '@/lib/recovery'

interface RecoveryDialogProps {
  choices: RecoveryChoice[]
  recover: (id: string) => Promise<void>
  discard: (id: string) => Promise<void>
  dismiss: () => void
}

export const RecoveryDialog: FC<RecoveryDialogProps> = ({ choices, recover, discard, dismiss }) => (
  <Dialog.Root
    open={choices.length > 0}
    onOpenChange={open => {
      if (!open) {
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
            <span className="min-w-0 flex-1 truncate text-sm">{choice.name}</span>
            <button
              className="secondary-action"
              onClick={() => {
                void recover(choice.id)
              }}
            >
              Restore
            </button>
            <button
              className="secondary-action"
              onClick={() => {
                void discard(choice.id)
              }}
            >
              Discard
            </button>
          </div>
        ))}
        <Dialog.Close className="secondary-action mt-3">Start without restoring</Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
)
