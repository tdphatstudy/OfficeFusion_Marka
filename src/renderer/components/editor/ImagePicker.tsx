import { useEffect, useMemo, useRef, useState, type FC, type PointerEvent } from 'react'
import { Image as ImageIcon, Search, X } from 'lucide-react'
import { chooseLocalImage, loadLocalImage } from '@/lib/localImages'
import {
  documentImages,
  imageUrl,
  resizeImageMarkup,
  searchCommons,
  searchOpenverse,
  searchTopMemes,
  type RemoteImageResult
} from '@/lib/remoteImages'
import { useEditorStore } from '@/stores/editorStore'

const DocumentThumbnail: FC<{ source: string }> = ({ source }) => {
  const location = useEditorStore(state => state.fileLocation)
  const documentId = useEditorStore(state => state.documentId)
  const element = useRef<HTMLDivElement>(null)
  const [url, setUrl] = useState(() => imageUrl(source) ?? '')
  useEffect(() => {
    const remote = imageUrl(source)
    if (remote) {
      setUrl(remote)
      return
    }
    setUrl('')
    if (location?.kind !== 'local' || !element.current) {
      return
    }
    const target = element.current
    let active = true
    const observer = new IntersectionObserver(entries => {
      if (!entries[0]?.isIntersecting) {
        return
      }
      observer.disconnect()
      void loadLocalImage(documentId, location.path, source)
        .then(value => {
          if (active) {
            setUrl(value)
          }
        })
        .catch(() => undefined)
    })
    observer.observe(target)
    return () => {
      active = false
      observer.disconnect()
    }
  }, [documentId, location, source])
  return (
    <div
      ref={element}
      className="flex h-16 w-20 shrink-0 items-center justify-center rounded bg-surface-raised"
    >
      {url ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-16 w-20 object-contain"
        />
      ) : (
        <ImageIcon size={20} className="text-text-secondary" />
      )}
    </div>
  )
}

export const ImagePicker: FC = () => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<'images' | 'gifs' | 'memes'>('images')
  const [tab, setTab] = useState<'search' | 'document'>('search')
  const [provider, setProvider] = useState<'Openverse' | 'Wikimedia Commons'>('Openverse')
  const [panelWidth, setPanelWidth] = useState(400)
  const [url, setUrl] = useState('')
  const [results, setResults] = useState<RemoteImageResult[]>([])
  const [selected, setSelected] = useState<RemoteImageResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const content = useEditorStore(state => state.content)
  const images = useMemo(
    () => (open && tab === 'document' ? documentImages(content) : []),
    [content, open, tab]
  )
  useEffect(() => {
    const show = (): void => setOpen(true)
    window.addEventListener('marka:open-image-picker', show)
    return () => window.removeEventListener('marka:open-image-picker', show)
  }, [])
  useEffect(() => {
    setResults([])
    setSelected(null)
    if (!open || tab !== 'search' || (mode !== 'memes' && !query.trim())) {
      setBusy(false)
      setError('')
      return
    }
    const controller = new AbortController()
    setBusy(true)
    setError('')
    const timer = setTimeout(() => {
      let request: Promise<RemoteImageResult[]>
      if (mode === 'memes') {
        request = searchTopMemes(query, controller.signal)
      } else if (provider === 'Openverse') {
        request = searchOpenverse(query, mode === 'gifs', controller.signal)
      } else {
        request = searchCommons(
          mode === 'gifs' ? `${query} filemime:"image/gif"` : query,
          controller.signal
        )
      }
      void request
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
    }, 350)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [open, tab, query, mode, provider])
  const insert = (source: string): void => {
    window.dispatchEvent(new CustomEvent('marka:insert-image', { detail: source }))
  }
  const manage = (action: 'locate' | 'remove' | 'resize', index: number, width?: number): void => {
    const image = images[index]
    if (!image) {
      return
    }
    if (action === 'locate') {
      window.dispatchEvent(
        new CustomEvent('marka:locate-image', { detail: { index, from: image.from } })
      )
      return
    }
    const replacement =
      action === 'remove'
        ? ''
        : resizeImageMarkup(content.slice(image.from, image.to), image, width ?? 0)
    if (replacement !== null) {
      useEditorStore
        .getState()
        .setContent(content.slice(0, image.from) + replacement + content.slice(image.to))
    }
  }
  const beginPanelResize = (event: PointerEvent<HTMLDivElement>): void => {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = panelWidth
    const move = (pointer: globalThis.PointerEvent): void => {
      setPanelWidth(
        Math.max(320, Math.min(720, window.innerWidth - 32, startWidth + startX - pointer.clientX))
      )
    }
    const stop = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', stop, { once: true })
    window.addEventListener('pointercancel', stop, { once: true })
  }
  let documentView = <p className="text-sm text-text-secondary">No images in this document yet.</p>
  if (content.length > 200_000) {
    documentView = (
      <p className="text-sm text-text-secondary">
        Image list is available for documents up to 200,000 characters.
      </p>
    )
  } else if (images.length > 0) {
    documentView = (
      <>
        {images.map((item, index) => (
          <div key={`${item.from}-${index}`} className="mb-3 rounded border border-border p-2">
            <div className="flex gap-2">
              <DocumentThumbnail source={item.source} />
              <div className="min-w-0">
                <p className="truncate text-sm">{item.alt || 'Image'}</p>
                <p className="truncate text-xs text-text-secondary" title={item.source}>
                  {item.source}
                </p>
                <p className="text-xs text-text-secondary">
                  {item.width ? `${item.width} px` : 'Auto width'}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                className="secondary-action"
                onClick={() => manage('locate', index)}
              >
                Locate
              </button>
              <label className="text-xs">
                Width{' '}
                <input
                  type="number"
                  min="80"
                  max="2400"
                  defaultValue={item.width ?? ''}
                  key={`${index}-${item.width}`}
                  placeholder="Auto"
                  aria-label={`Width for image ${index + 1}`}
                  className="w-20 rounded border border-border bg-transparent p-1"
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      const value = Number(event.currentTarget.value)
                      if (value >= 80 && value <= 2400) {
                        manage('resize', index, value)
                      }
                    }
                  }}
                  onBlur={event => {
                    const value = Number(event.currentTarget.value)
                    if (value >= 80 && value <= 2400 && value !== item.width) {
                      manage('resize', index, value)
                    }
                  }}
                />
              </label>
              <button
                type="button"
                className="secondary-action ml-auto"
                onClick={() => manage('remove', index)}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </>
    )
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
      {open && (
        <aside
          className="image-library fixed bottom-0 right-0 top-16 z-40 flex max-w-[calc(100vw-16px)] flex-col border-l border-border bg-surface text-text-primary shadow-xl"
          style={{ width: panelWidth }}
          aria-label="Image library"
        >
          <div
            className="image-panel-resizer"
            role="separator"
            aria-label="Resize image panel"
            aria-orientation="vertical"
            onPointerDown={beginPanelResize}
          />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Image library</h2>
              <p className="text-xs text-text-secondary">
                Find, insert and manage images in this document.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="toolbar-button"
              aria-label="Close image panel"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-2 border-b border-border py-2">
            <button
              type="button"
              className={tab === 'search' ? 'secondary-action border-accent' : 'secondary-action'}
              onClick={() => setTab('search')}
            >
              Search
            </button>
            <button
              type="button"
              className={tab === 'document' ? 'secondary-action border-accent' : 'secondary-action'}
              onClick={() => setTab('document')}
            >
              In document{tab === 'document' ? ` (${images.length})` : ''}
            </button>
          </div>
          {tab === 'search' ? (
            <>
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
                  className={
                    mode === 'gifs' ? 'secondary-action border-accent' : 'secondary-action'
                  }
                  onClick={() => setMode('gifs')}
                >
                  GIFs
                </button>
                <button
                  type="button"
                  className={
                    mode === 'memes' ? 'secondary-action border-accent' : 'secondary-action'
                  }
                  onClick={() => setMode('memes')}
                >
                  Popular memes
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
                  placeholder={
                    mode === 'memes'
                      ? 'Filter popular memes by name'
                      : 'Search photos, illustrations or GIFs'
                  }
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                />
              </label>
              {mode !== 'memes' ? (
                <label className="flex items-center gap-2 text-xs text-text-secondary">
                  Source{' '}
                  <select
                    className="rounded border border-border bg-surface px-2 py-1 text-text-primary"
                    aria-label="Image source"
                    value={provider}
                    onChange={event => setProvider(event.target.value as typeof provider)}
                  >
                    <option>Openverse</option>
                    <option>Wikimedia Commons</option>
                  </select>
                </label>
              ) : (
                <p className="text-xs text-text-secondary">
                  Popular meme templates from Imgflip, free to browse without an API key. Search
                  filters this list.
                </p>
              )}
              <div
                className="flex min-h-24 flex-1 flex-wrap content-start gap-2 overflow-y-auto"
                aria-busy={busy}
              >
                {results.map(item => (
                  <div
                    key={item.url}
                    className={`w-[calc(50%-4px)] min-w-32 rounded border p-1 hover:bg-surface-raised ${selected?.url === item.url ? 'border-accent' : 'border-border'}`}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => setSelected(item)}
                      title={`Select ${item.title}`}
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
                  </div>
                ))}
                {!query && mode !== 'memes' && (
                  <p className="text-sm text-text-secondary">
                    Search public images or GIFs. Check each file’s license before sharing.
                  </p>
                )}
                {(query || mode === 'memes') && !busy && !error && results.length === 0 && (
                  <p className="text-sm text-text-secondary">
                    {mode === 'memes'
                      ? 'No popular meme matches. Try a shorter name or switch to Images.'
                      : 'No matching files. Try the other source or paste a direct link.'}
                  </p>
                )}
              </div>
              {mode === 'gifs' && query && (
                <a
                  className="text-xs text-accent underline"
                  href={`https://giphy.com/search/${encodeURIComponent(query.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Find more GIFs on GIPHY ↗
                </a>
              )}
              {selected && (
                <div className="border-t border-border pt-2 text-xs">
                  <p className="truncate font-medium">{selected.title}</p>
                  <p className="text-text-secondary">
                    {selected.source}
                    {selected.creator ? ` · ${selected.creator}` : ''}
                    {selected.license ? ` · ${selected.license}` : ''}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <a
                      href={selected.page}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent underline"
                    >
                      Source & license
                    </a>
                    <button
                      type="button"
                      className="primary-action"
                      onClick={() => insert(selected.url)}
                    >
                      Insert image
                    </button>
                  </div>
                </div>
              )}
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
            </>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">{documentView}</div>
          )}
        </aside>
      )}
    </>
  )
}
