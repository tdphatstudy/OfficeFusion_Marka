let reader: (() => void) | null = null

export function registerEditorFlush(flush: () => void): () => void {
  reader = flush
  return () => {
    if (reader === flush) {
      reader = null
    }
  }
}

export function flushEditor(): void {
  reader?.()
}
