import { parseTarget, type FileLocation } from './connections'
import { checkedContent, editableBytes } from './documents'

export interface Draft {
  content: string
  savedContent: string
  filePath: string | null
  location?: FileLocation
}

export const draftKey = 'marka-draft-v1'

export function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey)
    if (!raw || raw.length > editableBytes * 2 + 16384) {
      return null
    }
    return parseDraft(JSON.parse(raw))
  } catch {
    return null
  }
}

export function parseDraft(value: unknown): Draft | null {
  try {
    if (
      typeof value !== 'object' ||
      value === null ||
      !('content' in value) ||
      !('savedContent' in value) ||
      !('filePath' in value)
    ) {
      return null
    }
    if (
      typeof value.content !== 'string' ||
      typeof value.savedContent !== 'string' ||
      (value.filePath !== null && typeof value.filePath !== 'string')
    ) {
      return null
    }
    checkedContent(value.content)
    checkedContent(value.savedContent)
    if (value.filePath && value.filePath.length > 4096) {
      return null
    }
    const draft: Draft = {
      content: value.content,
      savedContent: value.savedContent,
      filePath: value.filePath
    }
    if ('location' in value && value.location !== null && value.location !== undefined) {
      const location = parseTarget(value.location)
      if (location.kind === 'url') {
        return null
      }
      draft.location = location
    } else if (value.filePath?.startsWith('ssh://')) {
      return null
    }
    return draft
  } catch {
    return null
  }
}
