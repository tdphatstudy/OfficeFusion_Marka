import { useEffect, useState, type FC } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Image as ImageIcon, Search, X } from 'lucide-react'
import { chooseLocalImage } from '@/lib/localImages'
import { imageUrl, searchCommons, type CommonsImage } from '@/lib/remoteImages'

export const ImagePicker: FC = () => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'images' | 'gifs'>('images')
  const [url, setUrl] = useState('')
  const [results, setResults] = useState<CommonsImage[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    const show = (): void => setOpen(true)
    window.addEventListener('marka:open-image-picker', show)
    return () => window.removeEventListener('marka:open-image-picker', show)
  }, [])
  useEffect(() => {
    setResults([])
    if (!open || !query.trim()) {
      setBusy(false)
      setError('')
      return
    }
    const controller = new AbortController()
    setBusy(true)
    setError('')
    const timer = setTimeout(() => {
      void searchCommons(
        mode === 'gifs' ? `${query} filemime:"image/gif"` : query,
        controller.signal
      )
        .then(items =>
          setResults(mode === 'gifs' ? items.filter(item => item.mime === 'image/gif') : items)
        )
        .catch(cause => {
          if (!controller.signal.aborted) {
            setError(cause instanceof Error ? cause.message : 'Search failed.')
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setBusy(false)
          }
        })
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [open, query, mode])
  const insert = (source: string): void => {
    window.dispatchEvent(new CustomEvent('marka:insert-image', { detail: source }))
    setOpen(false)
  }
  return (
    <>
      <button
        type="button"
        className="toolbar-button"
        aria-label="Insert image"
        title="Insert image"
        onClick={() => setOpen(true)}
      >
        <ImageIcon size={16} />
      </button>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[min(680px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-lg border border-border bg-surface p-5 text-text-primary shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Dialog.Title className="text-base font-semibold">Insert image</Dialog.Title>
                <Dialog.Description className="text-xs text-text-secondary">
                  Search Wikimedia Commons, paste a direct HTTPS image URL, or choose a local file.
                  Online images stay as links in Markdown.
                </Dialog.Description>
              </div>
              <Dialog.Close className="toolbar-button" aria-label="Close image picker">
                <X size={16} />
              </Dialog.Close>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className={
                  mode === 'images' ? 'secondary-action border-accent' : 'secondary-action'
                }
                onClick={() => setMode('images')}
              >
                Images
              </button>
              <button
                type="button"
                className={mode === 'gifs' ? 'secondary-action border-accent' : 'secondary-action'}
                onClick={() => setMode('gifs')}
              >
                GIFs
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  void chooseLocalImage()
                    .then(path => {
                      if (path) {
                        insert(path)
                      }
                    })
                    .catch(cause =>
                      setError(
                        cause instanceof Error ? cause.message : 'Could not add local image.'
                      )
                    )
                }}
              >
                Local file
              </button>
            </div>
            <label className="flex items-center gap-2 rounded border border-border px-2">
              <Search size={16} className="text-text-secondary" />
              <input
                className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none"
                aria-label="Search public images"
                placeholder="Search Wikimedia Commons"
                value={query}
                onChange={event => setQuery(event.target.value)}
              />
            </label>
            <div
              className="flex min-h-24 flex-1 flex-wrap content-start gap-2 overflow-y-auto"
              aria-busy={busy}
            >
              {results.map(item => (
                <div
                  key={item.url}
                  className="w-[calc(33.333%-6px)] min-w-32 rounded border border-border p-1 hover:bg-surface-raised"
                >
                  <button
                    type="button"
                    className="w-full text-left"
                    onClick={() => insert(item.url)}
                    title={`Insert ${item.title}`}
                  >
                    <img
                      src={item.thumbnail}
                      alt={item.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-28 w-full rounded object-contain"
                    />
                    <span className="block truncate text-xs">{item.title}</span>
                  </button>
                  <a
                    href={item.page}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent underline"
                  >
                    Source & license
                  </a>
                </div>
              ))}
              {!query && (
                <p className="text-sm text-text-secondary">
                  Search photos or GIFs. Check each file’s license before sharing.
                </p>
              )}
              {query && !busy && !error && results.length === 0 && (
                <p className="text-sm text-text-secondary">
                  No matching images. Try another search.
                </p>
              )}
            </div>
            {error && (
              <p role="alert" className="text-sm text-red-500">
                {error}
              </p>
            )}
            <form
              onSubmit={event => {
                event.preventDefault()
                const valid = imageUrl(url)
                if (valid) {
                  insert(valid)
                } else {
                  setError('Enter a direct HTTPS image URL.')
                }
              }}
              className="flex gap-2 border-t border-border pt-3"
            >
              <input
                className="min-w-0 flex-1 rounded border border-border bg-transparent px-2 py-1 text-sm"
                aria-label="Direct image URL"
                placeholder="https://example.com/image.png"
                value={url}
                onChange={event => setUrl(event.target.value)}
              />
              <button className="primary-action" type="submit">
                Insert URL
              </button>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
