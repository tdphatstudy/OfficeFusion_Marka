import { parentPort, workerData } from 'node:worker_threads'
import { renderMarkdown } from '../shared/markdown'
import { checkedContent, exportCharacters } from '../shared/documents'
import { formatDocumentToHtml, formatDocumentToText } from '../shared/export'

try {
  const data: unknown = workerData
  if (
    !data ||
    typeof data !== 'object' ||
    !('content' in data) ||
    !('title' in data) ||
    !('format' in data) ||
    typeof data.title !== 'string' ||
    data.title.length > 256
  ) {
    throw new Error('Invalid export request.')
  }
  const content = checkedContent(data.content, exportCharacters)
  const output =
    data.format === 'txt'
      ? formatDocumentToText(content)
      : formatDocumentToHtml(data.title, renderMarkdown(content, 'mathml'))
  parentPort?.postMessage({ output })
} catch (error: unknown) {
  parentPort?.postMessage({ error: error instanceof Error ? error.message : 'Export failed.' })
}
