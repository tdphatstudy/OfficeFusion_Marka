export interface Draft {
  content: string
  savedContent: string
  filePath: string | null
}

export const draftKey = 'marka-draft-v1'

export function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(draftKey)
    if (!raw) {
      return null
    }
    const value: unknown = JSON.parse(raw)
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
    return { content: value.content, savedContent: value.savedContent, filePath: value.filePath }
  } catch {
    return null
  }
}
