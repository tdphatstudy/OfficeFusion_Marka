export function decodeDocument(data: Uint8Array): string {
  if (data.byteLength > 5 * 1024 * 1024) {
    throw new Error('Document exceeds the 5 MB connection limit.')
  }
  let content: string
  try {
    content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(data)
  } catch {
    throw new Error(
      'Choose a UTF-8 text document; this file uses a different encoding or contains binary data.'
    )
  }
  if (content.includes('\0')) {
    throw new Error('This appears to be a binary file. Choose a UTF-8 text document.')
  }
  return content
}
