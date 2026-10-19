import { createHash, randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { open, lstat, rename, unlink, chmod, type FileHandle } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { preservePermissions, usesWindowsAcl } from './filePermissions'
import {
  editableBytes,
  maximumViewerBytes,
  pageBytes,
  type DocumentPage,
  type OpenedFile,
  checkedContent
} from '../shared/documents'

export interface FileRevision {
  identity: string
  digest: string
}

function identity(info: { dev: number; ino: number }): string {
  return `${info.dev}:${info.ino}`
}

function stamp(info: {
  dev: number
  ino: number
  mtimeMs: number
  ctimeMs: number
  size: number
}): string {
  return `${identity(info)}:${info.mtimeMs}:${info.ctimeMs}:${info.size}`
}

export function decodeText(bytes: Uint8Array, streaming = false): string {
  let content: string
  try {
    content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes, {
      stream: streaming
    })
  } catch {
    throw new Error('Choose a UTF-8 text document. Unsupported encoding would lose data on save.')
  }
  if (content.includes('\0')) {
    throw new Error('Binary files cannot be opened as text.')
  }
  return content
}

async function openRegular(path: string): Promise<FileHandle> {
  const info = await lstat(path)
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error('Choose a regular file without symbolic links.')
  }
  const flags =
    constants.O_RDONLY |
    (process.platform === 'win32' ? 0 : constants.O_NONBLOCK | constants.O_NOFOLLOW)
  return open(path, flags)
}

export async function readEditable(
  path: string
): Promise<{ content: string; revision: FileRevision; mode: number }> {
  const file = await openRegular(path)
  try {
    const before = await file.stat()
    if (!before.isFile() || before.size > editableBytes) {
      throw new Error('Choose a regular text file no larger than 5 MiB.')
    }
    const bytes = Buffer.alloc(before.size + 1)
    let length = 0
    while (length < bytes.length) {
      const result = await file.read(bytes, length, bytes.length - length, length)
      if (!result.bytesRead) {
        break
      }
      length += result.bytesRead
    }
    const after = await file.stat()
    if (length !== before.size || stamp(before) !== stamp(after)) {
      throw new Error('File changed while reading. Reopen the document.')
    }
    const data = bytes.subarray(0, length)
    return {
      content: decodeText(data),
      revision: {
        identity: identity(before),
        digest: createHash('sha256').update(data).digest('hex')
      },
      mode: before.mode
    }
  } finally {
    await file.close()
  }
}

export function sameRevision(a: FileRevision, b: FileRevision): boolean {
  return a.identity === b.identity && a.digest === b.digest
}

export async function readRevision(path: string): Promise<FileRevision> {
  const file = await openRegular(path)
  try {
    const before = await file.stat()
    if (!before.isFile() || before.size > 32 * 1024 * 1024) {
      throw new Error(
        'Existing destination exceeds the safe replacement budget. Choose another file.'
      )
    }
    const hash = createHash('sha256')
    const buffer = Buffer.alloc(pageBytes)
    let offset = 0
    while (offset <= before.size) {
      const { bytesRead } = await file.read(
        buffer,
        0,
        Math.min(buffer.length, before.size + 1 - offset),
        offset
      )
      if (!bytesRead) {
        break
      }
      hash.update(buffer.subarray(0, bytesRead))
      offset += bytesRead
    }
    if (offset !== before.size || stamp(await file.stat()) !== stamp(before)) {
      throw new Error('File changed while checking its revision.')
    }
    return { identity: identity(before), digest: hash.digest('hex') }
  } finally {
    await file.close()
  }
}

export async function readTextRange(
  size: number,
  offset: number,
  read: (bytes: Buffer, offset: number) => Promise<number>
): Promise<DocumentPage> {
  if (
    !Number.isSafeInteger(size) ||
    size < 0 ||
    size > maximumViewerBytes ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset > size
  ) {
    throw new Error('Invalid byte range.')
  }
  const bytes = Buffer.alloc(Math.min(pageBytes, size - offset))
  let length = 0
  let attempts = 0
  while (length < bytes.length && attempts++ < 1024) {
    const count = await read(bytes.subarray(length), offset + length)
    if (!Number.isInteger(count) || count < 0 || count > bytes.length - length) {
      throw new Error('Invalid range response.')
    }
    if (!count) {
      throw new Error('File range ended unexpectedly. Reopen the file.')
    }
    length += count
  }
  if (bytes.length && !length) {
    throw new Error('File range could not be read. Reopen the file.')
  }
  let start = 0
  while (offset > 0 && start < Math.min(3, length) && ((bytes[start] ?? 0) & 0xc0) === 0x80) {
    start++
  }
  let end = length
  if (offset + end < size && end) {
    let lead = end - 1
    while (lead > start && ((bytes[lead] ?? 0) & 0xc0) === 0x80) {
      lead--
    }
    const byte = bytes[lead] ?? 0
    let width = 1
    if (byte >= 0xc0) {
      width = 2
    }
    if (byte >= 0xe0) {
      width = 3
    }
    if (byte >= 0xf0) {
      width = 4
    }
    if (end - lead < width) {
      end = lead
    }
  }
  if (end <= start && offset < size) {
    throw new Error('Incomplete UTF-8 range. Reopen the file.')
  }
  return {
    offset: offset + start,
    nextOffset: offset + end,
    text: decodeText(bytes.subarray(start, end))
  }
}

const writes = new Map<string, Promise<unknown>>()

export async function atomicWrite(
  path: string,
  content: Uint8Array,
  expected: FileRevision | null,
  replace: typeof rename = rename,
  authorize?: () => void
): Promise<FileRevision> {
  if (content.byteLength > 32 * 1024 * 1024) {
    throw new Error('Output exceeds the 32 MiB write budget.')
  }
  const key = process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path)
  const previous = writes.get(key) ?? Promise.resolve()
  const operation = previous
    .catch(() => undefined)
    .then(async () => {
      authorize?.()
      const verify = async (): Promise<number | undefined> => {
        try {
          const info = await lstat(path)
          if (info.isSymbolicLink() || !info.isFile() || info.nlink > 1) {
            throw new Error(
              'Safe Save requires a regular file without symbolic or hard links. Use Save As.'
            )
          }
          if (!expected || !sameRevision(await readRevision(path), expected)) {
            throw new Error(
              'File changed on disk. Your draft is safe. Compare or Save As a copy before reopening.'
            )
          }
          return info.mode
        } catch (error: unknown) {
          if (
            error instanceof Error &&
            'code' in error &&
            error.code === 'ENOENT' &&
            expected === null
          ) {
            return undefined
          }
          throw error
        }
      }
      const mode = await verify()
      const temporary = join(dirname(path), `.marka-${randomUUID()}.tmp`)
      try {
        let fileIdentity = ''
        let verifyPermissions: (() => Promise<void>) | undefined
        const protectedStage = mode !== undefined && usesWindowsAcl(path)
        if (protectedStage) {
          verifyPermissions = await preservePermissions(path, temporary)
        }
        const file = await open(temporary, protectedStage ? 'r+' : 'wx', 0o600)
        try {
          if (mode !== undefined && !protectedStage) {
            verifyPermissions = await preservePermissions(path, temporary)
          }
          await file.writeFile(content)
          await file.sync()
          fileIdentity = identity(await file.stat())
        } finally {
          await file.close()
        }
        if (mode !== undefined) {
          await chmod(temporary, mode)
        }
        await verify()
        await verifyPermissions?.()
        authorize?.()
        await replace(temporary, path)
        return {
          identity: fileIdentity,
          digest: createHash('sha256').update(content).digest('hex')
        }
      } finally {
        await unlink(temporary).catch(() => undefined)
      }
    })
  writes.set(key, operation)
  try {
    return await operation
  } finally {
    if (writes.get(key) === operation) {
      writes.delete(key)
    }
  }
}

interface Grant {
  revision: FileRevision
  content: string
  original: string
}

interface Reader {
  path: string
  file: FileHandle
  stamp: string
  size: number
}

export class FileAccess {
  private grants = new Map<string, Grant>()
  private readers = new Map<string, Reader>()
  private epoch = 0

  get generation(): number {
    return this.epoch
  }

  private assertGeneration(epoch: number): void {
    if (epoch !== this.epoch) {
      throw new Error('File access expired. Reopen the file.')
    }
  }

  private setGrant(path: string, grant: Grant): void {
    if (this.grants.size >= 4 && !this.grants.has(path)) {
      this.grants.clear()
    }
    this.grants.set(path, grant)
  }

  async open(path: string): Promise<OpenedFile> {
    const epoch = this.epoch
    const advertised = await lstat(path)
    if (!advertised.isFile() || advertised.isSymbolicLink()) {
      throw new Error('Choose a regular file without symbolic links.')
    }
    const file = await openRegular(path)
    const info = await file.stat().catch(async (error: unknown) => {
      await file.close()
      throw error
    })
    if (!info.isFile() || info.size > maximumViewerBytes) {
      await file.close()
      throw new Error('Choose a regular text file up to 10 GiB.')
    }
    if (info.size <= editableBytes) {
      await file.close()
      return this.refresh(path, true, epoch)
    }
    try {
      const prefix = Buffer.alloc(Math.min(info.size, pageBytes))
      const result = await file.read(prefix, 0, prefix.length, 0)
      decodeText(prefix.subarray(0, result.bytesRead), true)
      if (epoch !== this.epoch || stamp(await file.stat()) !== stamp(info)) {
        throw new Error('File access changed. Reopen the file.')
      }
      await this.closeReaders()
      this.assertGeneration(epoch)
      const handle = randomUUID()
      this.readers.set(handle, { path, file, stamp: stamp(info), size: info.size })
      return { path, content: '', paged: { handle, size: info.size } }
    } catch (error: unknown) {
      await file.close()
      throw error
    }
  }

  async refresh(path: string, allowNew = false, epoch = this.epoch): Promise<OpenedFile> {
    if (!allowNew && !this.grants.has(path)) {
      throw new Error('File access expired. Open the file again or Save As a copy.')
    }
    const result = await readEditable(path)
    if (epoch !== this.epoch) {
      throw new Error('File access expired. Reopen the file.')
    }
    this.setGrant(path, {
      revision: result.revision,
      content: result.content,
      original: result.content
    })
    return { path, content: result.content }
  }

  async inspect(path: string): Promise<OpenedFile> {
    const epoch = this.epoch
    if (!this.grants.has(path)) {
      throw new Error('File access expired. Open the file again or Save As a copy.')
    }
    const result = await readEditable(path)
    this.assertGeneration(epoch)
    return { path, content: result.content }
  }

  async save(path: string, content: string, expectedContent?: string): Promise<void> {
    const epoch = this.epoch
    checkedContent(content)
    const grant = this.grants.get(path)
    if (!grant || (expectedContent !== undefined && grant.content !== expectedContent)) {
      throw new Error('File access or baseline expired. Open the file again or Save As a copy.')
    }
    let output = content
    if (grant.original.includes('\r\n') && !/(?<!\r)\n/.test(grant.original)) {
      output = output.replace(/\r?\n/g, '\r\n')
    }
    if (grant.original.startsWith('\uFEFF') && !output.startsWith('\uFEFF')) {
      output = `\uFEFF${output}`
    }
    checkedContent(output)
    const revision = await atomicWrite(path, Buffer.from(output), grant.revision, rename, () =>
      this.assertGeneration(epoch)
    )
    if (epoch !== this.epoch) {
      throw new Error('Window changed while saving. Verify the file before retrying.')
    }
    this.setGrant(path, { revision, content, original: output })
  }

  async prepareSaveAs(path: string): Promise<FileRevision | null> {
    let revision: FileRevision | null = null
    try {
      revision = await readRevision(path)
    } catch (error: unknown) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) {
        throw error
      }
    }
    return revision
  }

  async saveAs(
    path: string,
    content: Uint8Array,
    expected: FileRevision | null,
    authorize?: () => void
  ): Promise<FileRevision> {
    return atomicWrite(path, content, expected, rename, authorize)
  }

  async saveAsText(path: string, content: string): Promise<void> {
    const epoch = this.epoch
    checkedContent(content)
    const expected = await this.prepareSaveAs(path)
    const revision = await this.saveAs(path, Buffer.from(content), expected, () =>
      this.assertGeneration(epoch)
    )
    if (epoch !== this.epoch) {
      throw new Error('Window changed while saving. Verify the file before retrying.')
    }
    this.setGrant(path, { revision, content, original: content })
  }

  async page(handle: string, offset: number): Promise<DocumentPage> {
    const reader = this.readers.get(handle)
    if (!reader || !Number.isSafeInteger(offset) || offset < 0 || offset > reader.size) {
      throw new Error('Invalid or expired page request.')
    }
    const verify = async (): Promise<void> => {
      if (
        stamp(await reader.file.stat()) !== reader.stamp ||
        stamp(await lstat(reader.path)) !== reader.stamp
      ) {
        throw new Error('File changed during viewing. Reopen it to start a new view.')
      }
    }
    await verify()
    const result = await readTextRange(
      reader.size,
      offset,
      async (bytes, position) =>
        (await reader.file.read(bytes, 0, bytes.length, position)).bytesRead
    )
    await verify()
    return result
  }

  async closeReaders(): Promise<void> {
    const readers = [...this.readers.values()]
    this.readers.clear()
    await Promise.all(readers.map(reader => reader.file.close().catch(() => undefined)))
  }

  async closeReader(handle: string): Promise<void> {
    const reader = this.readers.get(handle)
    this.readers.delete(handle)
    await reader?.file.close().catch(() => undefined)
  }

  async dispose(): Promise<void> {
    this.epoch++
    this.grants.clear()
    await this.closeReaders()
  }
}
