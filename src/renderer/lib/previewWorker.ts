import { renderMarkdown } from './preview'

interface PreviewRequest {
  id: number
  content: string
}

self.onmessage = (event: MessageEvent<PreviewRequest>): void => {
  const { id, content } = event.data
  try {
    self.postMessage({ id, source: content, html: renderMarkdown(content), error: false })
  } catch {
    self.postMessage({ id, source: content, html: '', error: true })
  }
}
