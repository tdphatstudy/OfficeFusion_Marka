import { useEffect, useState, type FC } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import type { Editor } from '@tiptap/core'
import { Table as TableIcon, X } from 'lucide-react'

export const TablePicker: FC<{ editor: Editor }> = ({ editor }) => {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState(3)
  const [columns, setColumns] = useState(3)
  const [header, setHeader] = useState(true)
  useEffect(() => {
    const show = (): void => setOpen(true)
    window.addEventListener('marka:open-table-picker', show)
    return () => window.removeEventListener('marka:open-table-picker', show)
  }, [])
  const insert = (): void => {
    editor.chain().focus().insertTable({ rows, cols: columns, withHeaderRow: header }).run()
    setOpen(false)
  }
  return (
    <>
      <button
        type="button"
        className="toolbar-button format-secondary"
        aria-label="Insert table"
        title="Insert table"
        onClick={() => setOpen(true)}
      >
        <TableIcon size={15} />
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(350px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 text-text-primary shadow-xl">
            <div className="flex items-center justify-between">
              <Dialog.Title className="font-semibold">Insert table</Dialog.Title>
              <Dialog.Close className="toolbar-button" aria-label="Close table picker">
                <X size={16} />
              </Dialog.Close>
            </div>
            <Dialog.Description className="mt-1 text-xs text-text-secondary">
              Choose a size, then drag column borders in Write mode to adjust widths.
            </Dialog.Description>
            <form
              onSubmit={event => {
                event.preventDefault()
                insert()
              }}
              className="mt-4 space-y-3"
            >
              <div className="flex gap-3">
                <label className="flex-1 text-xs">
                  Rows
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={rows}
                    onChange={event =>
                      setRows(Math.max(1, Math.min(30, Number(event.target.value) || 1)))
                    }
                    className="mt-1 w-full rounded border border-border bg-transparent p-2"
                  />
                </label>
                <label className="flex-1 text-xs">
                  Columns
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={columns}
                    onChange={event =>
                      setColumns(Math.max(1, Math.min(20, Number(event.target.value) || 1)))
                    }
                    className="mt-1 w-full rounded border border-border bg-transparent p-2"
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={header}
                  onChange={event => setHeader(event.target.checked)}
                />{' '}
                Header row
              </label>
              <button type="submit" className="primary-action w-full">
                Insert {rows} × {columns} table
              </button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
