import { constants } from 'node:fs'
import { lstat, mkdir, open, realpath } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'

export const maximumImageBytes = 8 * 1024 * 1024

async function readBounded(file: Awaited<ReturnType<typeof open>>, size: number): Promise<Buffer> {
  const bytes = Buffer.alloc(size + 1)
  let length = 0
  while (length < bytes.length) {
    const result = await file.read(bytes, length, bytes.length - length, length)
    if (!result.bytesRead) {
      break
    }
    length += result.bytesRead
  }
  if (length !== size) {
    throw new Error('Image changed while loading.')
  }
  return bytes.subarray(0, length)
}

export function imageMime(bytes: Uint8Array): string | null {
  const header = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  if (header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return 'image/png'
  }
  if (header[0] === 255 && header[1] === 216 && header[2] === 255) {
    return 'image/jpeg'
  }
  if (
    header.subarray(0, 6).toString() === 'GIF87a' ||
    header.subarray(0, 6).toString() === 'GIF89a'
  ) {
    return 'image/gif'
  }
  if (header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WEBP') {
    return 'image/webp'
  }
  return null
}

export function imageDimensions(
  bytes: Uint8Array,
  mime: string
): { width: number; height: number } | null {
  const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
  if (mime === 'image/png' && data.length >= 24) {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
  }
  if (mime === 'image/gif' && data.length >= 10) {
    return { width: data.readUInt16LE(6), height: data.readUInt16LE(8) }
  }
  if (mime === 'image/webp' && data.length >= 30) {
    const kind = data.subarray(12, 16).toString()
    if (kind === 'VP8X') {
      return {
        width: 1 + data.readUIntLE(24, 3),
        height: 1 + data.readUIntLE(27, 3)
      }
    }
    if (kind === 'VP8L' && data[20] === 0x2f) {
      return {
        width: 1 + ((data[21] ?? 0) | (((data[22] ?? 0) & 0x3f) << 8)),
        height:
          1 + (((data[22] ?? 0) >> 6) | ((data[23] ?? 0) << 2) | (((data[24] ?? 0) & 0x0f) << 10))
      }
    }
    if (kind === 'VP8 ' && data[23] === 0x9d && data[24] === 0x01 && data[25] === 0x2a) {
      return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff }
    }
  }
  if (mime === 'image/jpeg') {
    let position = 2
    while (position + 4 <= data.length) {
      if (data[position] !== 0xff) {
        return null
      }
      const marker = data[position + 1] ?? 0
      position += 2
      if (marker === 0xd9 || marker === 0xda) {
        break
      }
      if (marker === 0xff || marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
        continue
      }
      const length = data.readUInt16BE(position)
      if (length < 2 || position + length > data.length) {
        return null
      }
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        if (length < 7) {
          return null
        }
        return { width: data.readUInt16BE(position + 5), height: data.readUInt16BE(position + 3) }
      }
      position += length
    }
  }
  return null
}

function checkedImage(bytes: Uint8Array): string {
  const mime = imageMime(bytes)
  if (!mime) {
    throw new Error('Use a PNG, JPEG, GIF or WebP image.')
  }
  const dimensions = imageDimensions(bytes, mime)
  if (
    !dimensions ||
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    dimensions.width > 8192 ||
    dimensions.height > 8192 ||
    dimensions.width * dimensions.height > 32 * 1024 * 1024
  ) {
    throw new Error('Image dimensions are invalid or exceed 32 megapixels.')
  }
  return mime
}

export function relativeImagePath(documentPath: string, reference: string): string {
  if (!reference || reference.length > 1024 || /[?#\x00-\x1f]/.test(reference)) {
    throw new Error('Choose a relative image path without a query or fragment.')
  }
  let decoded: string
  try {
    decoded = decodeURIComponent(reference)
  } catch {
    throw new Error('Invalid image path encoding.')
  }
  if (
    /^[a-z][a-z\d+.-]*:/i.test(decoded) ||
    isAbsolute(decoded) ||
    decoded.startsWith('\\\\') ||
    decoded.split(/[\\/]/).includes('..') ||
    /[\x00-\x1f]/.test(decoded)
  ) {
    throw new Error('Image must be inside the document folder.')
  }
  const root = resolve(dirname(documentPath))
  const candidate = resolve(root, decoded)
  const inside = relative(root, candidate)
  if (!inside || inside.startsWith(`..${sep}`) || inside === '..' || isAbsolute(inside)) {
    throw new Error('Image must be inside the document folder.')
  }
  return candidate
}

export async function readDocumentImage(documentPath: string, reference: string): Promise<string> {
  const path = relativeImagePath(documentPath, reference)
  const root = await realpath(dirname(documentPath))
  const resolved = await realpath(path)
  const inside = relative(root, resolved)
  if (!inside || inside.startsWith(`..${sep}`) || inside === '..' || isAbsolute(inside)) {
    throw new Error('Image must be inside the document folder.')
  }
  const advertised = await lstat(path)
  if (!advertised.isFile() || advertised.isSymbolicLink()) {
    throw new Error('Image must be a regular file.')
  }
  const file = await open(
    path,
    constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NOFOLLOW)
  )
  try {
    const before = await file.stat()
    if (!before.isFile() || before.size > maximumImageBytes) {
      throw new Error('Image exceeds the 8 MiB limit.')
    }
    const bytes = await readBounded(file, before.size)
    const after = await file.stat()
    if (
      bytes.length !== before.size ||
      before.mtimeMs !== after.mtimeMs ||
      before.ino !== after.ino
    ) {
      throw new Error('Image changed while loading.')
    }
    const mime = checkedImage(bytes)
    return `data:${mime};base64,${bytes.toString('base64')}`
  } finally {
    await file.close()
  }
}

export async function importDocumentImage(
  documentPath: string,
  pickedPath: string
): Promise<string> {
  const selected = await lstat(pickedPath)
  if (!selected.isFile() || selected.isSymbolicLink() || selected.size > maximumImageBytes) {
    throw new Error('Choose a regular image up to 8 MiB.')
  }
  const source = await open(
    pickedPath,
    constants.O_RDONLY | (process.platform === 'win32' ? 0 : constants.O_NOFOLLOW)
  )
  let bytes: Buffer
  try {
    bytes = await readBounded(source, selected.size)
    const after = await source.stat()
    if (
      bytes.length !== selected.size ||
      after.mtimeMs !== selected.mtimeMs ||
      after.ino !== selected.ino
    ) {
      throw new Error('Selected image changed while importing.')
    }
  } finally {
    await source.close()
  }
  const mime = checkedImage(bytes)
  const extension = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp'
  }[mime]
  const root = dirname(documentPath)
  const folder = join(root, 'assets')
  await mkdir(folder, { recursive: true })
  const info = await lstat(folder)
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    (await realpath(folder)) !== join(await realpath(root), 'assets')
  ) {
    throw new Error('The assets folder must be a regular folder next to the document.')
  }
  const stem =
    basename(pickedPath, extname(pickedPath))
      .replace(/[^\p{L}\p{N}._-]/gu, '-')
      .slice(0, 60) || 'image'
  const name = `${stem}-${randomUUID().slice(0, 8)}${extension}`
  const output = await open(join(folder, name), 'wx', 0o644)
  try {
    await output.writeFile(bytes)
    await output.sync()
  } finally {
    await output.close()
  }
  return `assets/${name}`
}
