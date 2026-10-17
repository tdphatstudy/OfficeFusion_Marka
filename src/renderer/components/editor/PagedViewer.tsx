import { useEffect, useState, type FC } from 'react'
import type { PagedDocument, DocumentPage } from '../../../shared/documents'

interface PagedViewerProps {
  document: PagedDocument
}

export const PagedViewer: FC<PagedViewerProps> = ({ document }) => {
  const [offset, setOffset] = useState(0)
  const [position, setPosition] = useState('0')
  const [page, setPage] = useState<DocumentPage | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    void window.api
      .readPage(document.handle, offset)
      .then(result => {
        if (active) {
          setPage(result)
          setPosition(String(result.offset))
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Could not read this page.')
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [document.handle, offset])
  useEffect(
    () => () => {
      void window.api.closeReader(document.handle).catch(() => undefined)
    },
    [document.handle]
  )
  let status = ''
  if (page) {
    status = `Bytes ${page.offset.toLocaleString()}–${page.nextOffset.toLocaleString()} of ${document.size.toLocaleString()}`
  }
  if (loading) {
    status = 'Loading…'
  }
  return (
    <section aria-label="Large file viewer" className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border bg-surface-raised px-4 py-2 text-xs">
        <strong>Read-only file viewer</strong> · {(document.size / 1024 / 1024).toFixed(1)} MiB
        <p className="mt-1 text-text-secondary">
          Only this byte range is loaded. Editing, full preview and export are unavailable. Reopen
          if another application changes the file.
        </p>
      </div>
      <form
        className="flex flex-wrap items-center gap-2 border-b border-border p-2 text-xs"
        onSubmit={event => {
          event.preventDefault()
          const value = Number(position)
          if (Number.isSafeInteger(value) && value >= 0 && value <= document.size) {
            setOffset(value)
          }
        }}
      >
        <button
          type="button"
          className="secondary-action"
          disabled={loading || offset === 0}
          onClick={() => setOffset(Math.max(0, offset - 64 * 1024))}
        >
          Previous range
        </button>
        <button
          type="button"
          className="secondary-action"
          disabled={loading || !page || page.nextOffset >= document.size}
          onClick={() => {
            if (page) {
              setOffset(page.nextOffset)
            }
          }}
        >
          Next range
        </button>
        <label>
          Byte offset{' '}
          <input
            aria-label="Byte offset"
            className="w-28 rounded border border-border bg-surface px-2 py-1"
            inputMode="numeric"
            value={position}
            onChange={event => setPosition(event.target.value)}
          />
        </label>
        <button type="submit" className="secondary-action" disabled={loading}>
          Go to byte
        </button>
        <span role="status">{status}</span>
      </form>
      {error ? (
        <p role="alert" className="p-4 text-sm">
          {error}
        </p>
      ) : (
        <pre
          aria-label="File range"
          className="min-h-0 flex-1 overflow-auto whitespace-pre p-4 font-mono text-sm"
        >
          {page?.text}
        </pre>
      )}
    </section>
  )
}
