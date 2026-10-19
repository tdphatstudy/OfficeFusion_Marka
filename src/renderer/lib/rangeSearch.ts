import type { DocumentPage } from '../../shared/documents'

export async function searchRanges(
  read: (offset: number) => Promise<DocumentPage>,
  query: string,
  start: number,
  size: number,
  signal: AbortSignal,
  progress: (offset: number) => void
): Promise<{ match: number | null; next: number; done: boolean }> {
  if (!query || query.length > 1000 || !query.isWellFormed()) {
    throw new Error('Enter up to 1,000 characters to search.')
  }
  const encoder = new TextEncoder()
  let next = start
  let carry = ''
  let bytes = 0
  while (next < size && bytes < 8 * 1024 * 1024) {
    signal.throwIfAborted()
    const page = await read(next)
    signal.throwIfAborted()
    if (page.nextOffset <= next) {
      throw new Error('Search could not advance to the next range.')
    }
    const text = carry + page.text
    const index = text.indexOf(query)
    if (index >= 0) {
      const match =
        page.offset - encoder.encode(carry).length + encoder.encode(text.slice(0, index)).length
      return { match, next: match + encoder.encode(query).length, done: false }
    }
    carry = Array.from(text).slice(-query.length).join('')
    bytes += page.nextOffset - next
    next = page.nextOffset
    progress(next)
  }
  const done = next >= size
  return { match: null, next: done ? next : next - encoder.encode(carry).length, done }
}
