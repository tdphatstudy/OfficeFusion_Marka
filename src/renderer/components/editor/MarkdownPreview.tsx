import { useEffect, useRef, useState, type FC } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import 'katex/dist/katex.min.css'
import { createLatestTask } from '@/lib/latestTask'
import { previewCharacters } from '../../../shared/documents'

interface PreviewResult {
  id: number
  html: string
  error: boolean
}

export const MarkdownPreview: FC = () => {
  const content = useEditorStore(state => state.content)
  const [result, setResult] = useState<PreviewResult>({ id: 0, html: '', error: false })
  const queue = useRef<ReturnType<
    typeof createLatestTask<{ id: number; content: string }, PreviewResult>
  > | null>(null)
  const requestId = useRef(0)
  const preview = useRef<HTMLElement>(null)
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
  }, [])
  useEffect(() => {
    const id = ++requestId.current
    const timer = setTimeout(() => queue.current?.submit({ id, content }), 120)
    return () => {
      clearTimeout(timer)
    }
  }, [content])
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
        <span>{status}</span>
      </div>
      <div className="preview-scroll flex-1 overflow-auto p-6">
        {result.error ? (
          <p role="alert" className="text-sm text-text-secondary">
            Preview is paused because this document exceeds a rendering budget or could not render.
            Your source is safe; use Markdown mode or a smaller section.
          </p>
        ) : (
          <article
            ref={preview}
            className="markdown-preview prose dark:prose-invert mx-auto max-w-3xl text-text-primary"
            dangerouslySetInnerHTML={{ __html: result.html }}
          />
        )}
      </div>
    </section>
  )
}
