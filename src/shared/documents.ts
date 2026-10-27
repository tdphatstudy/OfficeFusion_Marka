export const editableBytes = 5 * 1024 * 1024
export const previewCharacters = 256 * 1024
export const exportCharacters = 512 * 1024
export const pageBytes = 64 * 1024
export const maximumViewerBytes = 10 * 1024 * 1024 * 1024

export interface PagedDocument {
  handle: string
  size: number
}

export interface DocumentPage {
  offset: number
  nextOffset: number
  text: string
}

export interface OpenedFile {
  path: string
  content: string
  paged?: PagedDocument
}

export function checkedContent(value: unknown, maximum = editableBytes): string {
  if (
    typeof value !== 'string' ||
    !value.isWellFormed() ||
    value.length > maximum ||
    new TextEncoder().encode(value).length > maximum ||
    value.includes('\0')
  ) {
    throw new Error('Document exceeds the supported text budget or contains binary data.')
  }
  return value
}
