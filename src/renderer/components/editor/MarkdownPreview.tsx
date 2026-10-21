import { useEffect, useRef, useState, type FC } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import 'katex/dist/katex.min.css'
import { createLatestTask } from '@/lib/latestTask'
import { changeViewMode } from '@/lib/commands'
import { previewCharacters } from '../../../shared/documents'
import { loadLocalImage } from '@/lib/localImages'
import { writingFonts } from '../../../shared/fonts'

interface PreviewResult {
  id: number
  html: string
  error: boolean
}

export const MarkdownPreview: FC = () => {
  const content = useEditorStore(state => state.content)
  const location = useEditorStore(state => state.fileLocation)
  const documentId = useEditorStore(state => state.documentId)
  const fontFamily = useEditorStore(state => state.config.fontFamily)
  const [result, setResult] = useState<PreviewResult>({ id: 0, html: '', error: false })
  const queue = useRef<ReturnType<
    typeof createLatestTask<{ id: number; content: string }, PreviewResult>
  > | null>(null)
  const [revision, setRevision] = useState(0)
  const [follow, setFollow] = useState(false)
  const requestId = useRef(0)
  const preview = useRef<HTMLElement>(null)
  useEffect(() => {
    const container = preview.current
    if (!container || result.error || !result.html) {
      return
    }
    const images = [...container.querySelectorAll<HTMLImageElement>('img[data-markdown-src]')]
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting || !(entry.target instanceof HTMLImageElement)) {
            continue
          }
          observer.unobserve(entry.target)
          const image = entry.target
          const reference = image.dataset.markdownSrc
          if (!reference || location?.kind !== 'local') {
            image.replaceWith(
              Object.assign(document.createElement('span'), {
                textContent: 'Image unavailable: save locally to load images.'
              })
            )
            continue
          }
          void loadLocalImage(documentId, location.path, reference)
            .then(url => {
              if (image.isConnected) {
                image.src = url
              }
            })
            .catch(() => {
              if (image.isConnected) {
                image.replaceWith(
                  Object.assign(document.createElement('span'), {
                    textContent: `Image unavailable: ${reference}`
                  })
                )
              }
            })
        }
      },
      { root: container.parentElement, rootMargin: '300px' }
    )
    for (const image of images) {
      observer.observe(image)
    }
    return () => observer.disconnect()
  }, [result.html, result.error, location, documentId])
  useEffect(() => {
    let reusable: Worker | null = null
    const instance = createLatestTask<{ id: number; content: string }, PreviewResult>(
      (request, signal) =>
        new Promise((resolve, reject) => {
          if (request.content.length > previewCharacters) {
            resolve({ id: request.id, html: '', error: true })
            return
          }
          reusable ??= new Worker(new URL('../../lib/previewWorker.ts', import.meta.url), {
            type: 'module'
          })
          const worker = reusable
          const abort = (): void => {
            worker.terminate()
            reusable = null
            reject(new Error('Preview cancelled.'))
          }
          signal.addEventListener('abort', abort, { once: true })
          const cleanup = (): void => {
            signal.removeEventListener('abort', abort)
          }
          worker.onmessage = (event: MessageEvent<PreviewResult>): void => {
            cleanup()
            resolve(event.data)
          }
          worker.onerror = (): void => {
            cleanup()
            worker.terminate()
            reusable = null
            reject(new Error('Preview failed.'))
          }
          worker.postMessage(request)
        }),
      value => {
        if (value.id === requestId.current) {
          setResult(value)
        }
      },
      () => setResult({ id: requestId.current, html: '', error: true })
    )
    queue.current = instance
    return () => {
      instance.dispose()
      reusable?.terminate()
      queue.current = null
    }
  }, [revision])
  useEffect(() => {
    const id = ++requestId.current
    const timer = setTimeout(() => queue.current?.submit({ id, content }), 120)
    return () => {
      clearTimeout(timer)
    }
  }, [content, revision])
  useEffect(() => {
    const navigate = (event: Event): void => {
      if (!(event instanceof CustomEvent)) {
        return
      }
      const detail: unknown = event.detail
      if (
        typeof detail === 'object' &&
        detail !== null &&
        'line' in detail &&
        typeof detail.line === 'number'
      ) {
        preview.current
          ?.querySelector(`[data-source-line="${detail.line}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
    window.addEventListener('marka:navigate', navigate)
    return () => {
      window.removeEventListener('marka:navigate', navigate)
    }
  }, [])

  useEffect(() => {
    if (!follow) {
      return
    }
    const position = (event: Event): void => {
      if (!(event instanceof CustomEvent)) {
        return
      }
      const detail: unknown = event.detail
      if (
        !detail ||
        typeof detail !== 'object' ||
        !('line' in detail) ||
        typeof detail.line !== 'number'
      ) {
        return
      }
      let target: HTMLElement | null = null
      for (const element of preview.current?.querySelectorAll<HTMLElement>('[data-source-line]') ??
        []) {
        if (Number(element.dataset.sourceLine) <= detail.line) {
          target = element
        } else {
          break
        }
      }
      const container = preview.current?.parentElement
      if (target && container) {
        container.scrollTop +=
          target.getBoundingClientRect().top - container.getBoundingClientRect().top
      }
    }
    window.addEventListener('marka:position', position)
    return () => window.removeEventListener('marka:position', position)
  }, [follow])
  let status = result.id === requestId.current && result.id > 0 ? 'Up to date' : 'Updating…'
  if (result.error) {
    status = 'Unavailable'
  }

  return (
    <section
      aria-label="Markdown preview"
      className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface"
    >
      <div className="pane-heading">
        <span>Preview</span>
        <label className="flex items-center gap-1">
          <input
            type="checkbox"
            checked={follow}
            onChange={event => setFollow(event.target.checked)}
          />
          Follow source
        </label>
        <span>{status}</span>
      </div>
      <div className="preview-scroll flex-1 overflow-auto p-6">
        {result.error ? (
          <div role="alert" className="text-sm text-text-secondary">
            <p>
              Preview is paused because this document exceeds a rendering budget or could not
              render. Your source is safe; use Markdown mode or a smaller section.
            </p>
            <div className="mt-3 flex gap-2">
              <button className="secondary-action" onClick={() => changeViewMode('source')}>
                Open Markdown mode
              </button>
              {content.length <= previewCharacters && (
                <button
                  className="secondary-action"
                  onClick={() => {
                    setResult({ id: 0, html: '', error: false })
                    setRevision(revision + 1)
                  }}
                >
                  Retry preview
                </button>
              )}
            </div>
          </div>
        ) : (
          <article
            ref={preview}
            className="markdown-preview prose dark:prose-invert mx-auto max-w-3xl text-text-primary"
            style={{ fontFamily: writingFonts[fontFamily] }}
            dangerouslySetInnerHTML={{ __html: result.html }}
          />
        )}
      </div>
    </section>
  )
}
