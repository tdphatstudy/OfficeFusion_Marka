import { useEffect, useRef, useState, type FC } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import 'katex/dist/katex.min.css'

export const MarkdownPreview: FC = () => {
  const content = useEditorStore(state => state.content)
  const [result, setResult] = useState({ id: 0, source: '', html: '', error: false })
  const worker = useRef<Worker | null>(null)
  const requestId = useRef(0)
  const preview = useRef<HTMLElement>(null)
  useEffect(() => {
    const instance = new Worker(new URL('../../lib/previewWorker.ts', import.meta.url), {
      type: 'module'
    })
    worker.current = instance
    instance.onmessage = (
      event: MessageEvent<{ id: number; source: string; html: string; error: boolean }>
    ): void => {
      if (event.data.id === requestId.current) {
        setResult(event.data)
      }
    }
    instance.onerror = (): void => {
      setResult({ id: requestId.current, source: '', html: '', error: true })
    }
    return () => {
      instance.terminate()
      worker.current = null
    }
  }, [])
  useEffect(() => {
    const id = ++requestId.current
    const timer = setTimeout(() => worker.current?.postMessage({ id, content }), 120)
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

  let status = result.source === content && result.id > 0 ? 'Up to date' : 'Updating…'
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
            Preview could not render. Your source is safe; try editing the last block.
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
