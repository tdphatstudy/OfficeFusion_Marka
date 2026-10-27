import { useEffect, useRef, useState, type FC } from 'react'
import { ArrowLeft, ArrowRight, ArrowUp, Folder, FileText, Home, RefreshCw } from 'lucide-react'
import type { BrowserPage, BrowserQuery, BrowserSession } from '../../../shared/browser'
import { createLatestTask } from '@/lib/latestTask'
import { fileActions } from '@/lib/fileActions'
import { useUIStore } from '@/stores/uiStore'

export const FileBrowser: FC<{ session: BrowserSession; back: () => void }> = ({
  session,
  back
}) => {
  const [history, setHistory] = useState([session.home])
  const [index, setIndex] = useState(0)
  const [filter, setFilter] = useState('')
  const [hidden, setHidden] = useState(false)
  const [markdownOnly, setMarkdownOnly] = useState(true)
  const [offset, setOffset] = useState(0)
  const [revision, setRevision] = useState(0)
  const [page, setPage] = useState<BrowserPage | null>(null)
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const busy = useUIStore(state => state.fileBusy)
  const path = history[index] ?? session.home
  const separator = session.root.includes('\\') ? '\\' : '/'
  const segments = path.slice(session.root.length).split(separator).filter(Boolean)
  const queue = useRef<ReturnType<
    typeof createLatestTask<BrowserQuery, { page?: BrowserPage; error?: string }>
  > | null>(null)
  useEffect(() => {
    const instance = createLatestTask<BrowserQuery, { page?: BrowserPage; error?: string }>(
      async query => {
        try {
          return { page: await window.api.listFolder(session.id, query) }
        } catch (reason: unknown) {
          return { error: reason instanceof Error ? reason.message : 'Could not read this folder.' }
        }
      },
      result => {
        setPage(result.page ?? null)
        setError(result.error ?? '')
        setLoading(false)
      },
      () => {
        setError('Folder request timed out. Retry or reconnect.')
        setLoading(false)
      },
      35000
    )
    queue.current = instance
    return () => {
      instance.dispose()
      if (queue.current === instance) {
        queue.current = null
      }
    }
  }, [session.id])
  useEffect(() => {
    setLoading(true)
    setSelected('')
    const timer = setTimeout(
      () => queue.current?.submit({ path, filter, hidden, markdownOnly, offset }),
      150
    )
    return () => clearTimeout(timer)
  }, [path, filter, hidden, markdownOnly, offset, revision])
  const navigate = (target: string): void => {
    setHistory(current => [...current.slice(0, index + 1), target])
    setIndex(index + 1)
    setFilter('')
    setOffset(0)
  }
  const open = async (target: string): Promise<void> => {
    setError('')
    if (await fileActions.openBrowser(session.id, target)) {
      useUIStore.getState().setConnectionsOpen(false)
    } else {
      const notice = useUIStore.getState().notice
      if (notice?.error) {
        setError(notice.message)
        useUIStore.getState().dismissNotice()
      }
    }
  }
  return (
    <section aria-label="File browser" className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button className="secondary-action" disabled={busy} onClick={back}>
          Sources
        </button>
        <strong className="text-sm">{session.label}</strong>
      </div>
      <div className="flex items-center gap-1" role="group" aria-label="Folder navigation">
        <button
          className="icon-button"
          aria-label="Back folder"
          disabled={busy || index === 0}
          onClick={() => {
            setIndex(index - 1)
            setFilter('')
            setOffset(0)
          }}
        >
          <ArrowLeft size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="Forward folder"
          disabled={busy || index >= history.length - 1}
          onClick={() => {
            setIndex(index + 1)
            setFilter('')
            setOffset(0)
          }}
        >
          <ArrowRight size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="Parent folder"
          disabled={busy || loading || !page?.parent}
          onClick={() => {
            if (page?.parent) {
              navigate(page.parent)
            }
          }}
        >
          <ArrowUp size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="Home folder"
          disabled={busy}
          onClick={() => navigate(session.home)}
        >
          <Home size={16} />
        </button>
        <button
          className="icon-button"
          aria-label="Refresh folder"
          disabled={busy || loading}
          onClick={() => setRevision(revision + 1)}
        >
          <RefreshCw size={16} />
        </button>
        <span className="min-w-0 flex-1 truncate text-xs text-text-secondary" title={path}>
          {path}
        </span>
      </div>
      <nav aria-label="Folder breadcrumbs" className="flex shrink-0 flex-wrap gap-1 text-xs">
        <button
          className="rounded px-1 py-1 text-accent hover:underline"
          disabled={busy}
          onClick={() => navigate(session.root)}
        >
          Root
        </button>
        {segments.map((segment, position) => (
          <span key={`${segment}-${position}`} className="flex items-center gap-1">
            <span>/</span>
            <button
              className="rounded px-1 py-1 text-accent hover:underline"
              disabled={busy}
              onClick={() =>
                navigate(
                  `${session.root.replace(/[\\/]$/, '')}${separator}${segments.slice(0, position + 1).join(separator)}`
                )
              }
            >
              {segment}
            </button>
          </span>
        ))}
      </nav>
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Filter this folder"
          placeholder="Filter this folder…"
          className="connection-input !w-auto min-w-40 flex-1"
          value={filter}
          disabled={busy}
          onChange={event => {
            setFilter(event.target.value)
            setOffset(0)
          }}
        />
        <select
          aria-label="File type filter"
          className="connection-input !w-auto max-w-full"
          value={markdownOnly ? 'markdown' : 'all'}
          disabled={busy}
          onChange={event => {
            setMarkdownOnly(event.target.value === 'markdown')
            setOffset(0)
          }}
        >
          <option value="markdown">Markdown files</option>
          <option value="all">All files</option>
        </select>
        <label className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={hidden}
            disabled={busy}
            onChange={event => {
              setHidden(event.target.checked)
              setOffset(0)
            }}
          />
          Hidden files
        </label>
      </div>
      <div
        className="min-h-0 flex-1 overflow-auto rounded border border-border"
        aria-busy={loading}
      >
        {loading && (
          <div className="p-4 text-xs">
            <p role="status">Loading folder…</p>
            <button
              type="button"
              className="secondary-action mt-2"
              onClick={() => window.api.cancelConnection()}
            >
              Cancel loading
            </button>
          </div>
        )}
        {!loading && error && (
          <div role="alert" className="p-4 text-xs">
            <p>{error}</p>
            <button className="secondary-action mt-3" onClick={() => setRevision(revision + 1)}>
              Retry
            </button>
          </div>
        )}
        {!loading && !error && (
          <>
            {page?.entries.length === 0 && (
              <p role="status" className="p-4 text-xs">
                No matching files or folders. Try another filter or show all files.
              </p>
            )}
            <ul
              aria-label="Files and folders"
              onKeyDown={event => {
                const buttons = Array.from(
                  event.currentTarget.querySelectorAll<HTMLButtonElement>('li > button')
                )
                const current = buttons.indexOf(event.target as HTMLButtonElement)
                let next = current
                if (event.key === 'ArrowDown') {
                  next = Math.min(buttons.length - 1, current + 1)
                } else if (event.key === 'ArrowUp') {
                  next = Math.max(0, current - 1)
                } else if (event.key === 'Home') {
                  next = 0
                } else if (event.key === 'End') {
                  next = buttons.length - 1
                } else {
                  return
                }
                event.preventDefault()
                buttons[next]?.focus()
              }}
            >
              {page?.entries.map(entry => (
                <li key={entry.path}>
                  <button
                    type="button"
                    aria-label={`${entry.directory ? 'Folder' : 'File'} ${entry.name}`}
                    aria-pressed={!entry.directory && selected === entry.path}
                    disabled={busy}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-overlay ${selected === entry.path ? 'bg-surface-overlay' : ''}`}
                    onClick={() => {
                      if (entry.directory) {
                        navigate(entry.path)
                      } else {
                        setSelected(entry.path)
                      }
                    }}
                    onDoubleClick={() => {
                      if (!entry.directory) {
                        void open(entry.path)
                      }
                    }}
                    onKeyDown={event => {
                      if (event.key === 'Enter' && !entry.directory) {
                        event.preventDefault()
                        void open(entry.path)
                      }
                    }}
                  >
                    {entry.directory ? <Folder size={16} /> : <FileText size={16} />}
                    <span className="min-w-0 truncate">{entry.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
        <div className="flex gap-2">
          <button
            className="secondary-action"
            disabled={busy || loading || offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 200))}
          >
            Previous files
          </button>
          <button
            className="secondary-action"
            disabled={busy || loading || !page?.truncated || !page.entries.length || offset >= 9800}
            onClick={() => setOffset(offset + 200)}
          >
            More files
          </button>
        </div>
        <button
          className="primary-action"
          disabled={busy || loading || !selected}
          onClick={() => void open(selected)}
        >
          Open selected file
        </button>
      </footer>
      {page?.truncated && (
        <p className="text-xs text-text-secondary">
          Showing up to 200 matches per page; folders are scanned up to 10,000 entries. Narrow the
          location if a file is missing.
        </p>
      )}
    </section>
  )
}
