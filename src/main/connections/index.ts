import { stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { basename, join } from 'node:path'
import { runProcess } from './process'
import { decodeDocument } from './document'
import { readSshFile, writeSshFile } from './ssh'
import {
  parseTarget,
  targetLabel,
  type ConnectedDocument,
  type SshCredentials,
  type ConnectionCapabilities
} from '../../shared/connections'

export async function connectionCapabilities(): Promise<ConnectionCapabilities> {
  const result: ConnectionCapabilities = {
    platform: process.platform,
    sshAvailable: true,
    wslDistributions: [],
    wslError: null
  }
  if (process.platform === 'win32') {
    try {
      const data = await runProcess(
        join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'wsl.exe'),
        ['--list', '--quiet'],
        { timeoutMs: 10_000 }
      )
      result.wslDistributions = data
        .toString('utf16le')
        .replaceAll('\0', '')
        .split(/\r?\n/)
        .map(name => name.trim())
        .filter(name => /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name))
    } catch {
      result.wslError =
        'WSL is unavailable or could not be queried. Install/start WSL, then refresh. You can also paste a \\\\wsl.localhost path in Network / Path.'
    }
  }
  return result
}

export async function readUrl(rawUrl: string, signal?: AbortSignal): Promise<string> {
  let current = rawUrl
  const timeout = AbortSignal.timeout(15_000)
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout
  for (let redirect = 0; redirect <= 5; redirect++) {
    const target = parseTarget({ kind: 'url', url: current })
    if (target.kind !== 'url') {
      throw new Error('Invalid URL.')
    }
    const response = await fetch(target.url, {
      signal: combined,
      redirect: 'manual',
      headers: { Accept: 'text/markdown, text/plain;q=0.9' }
    })
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel()
      const location = response.headers.get('location')
      if (!location) {
        throw new Error('URL redirect has no destination.')
      }
      current = new URL(location, target.url).href
      continue
    }
    if (!response.ok) {
      await response.body?.cancel()
      throw new Error(`URL returned HTTP ${response.status}.`)
    }
    if (response.headers.get('content-type')?.includes('text/html')) {
      await response.body?.cancel()
      throw new Error('This URL returns a web page. Use the raw Markdown or plain-text URL.')
    }
    const reader = response.body?.getReader()
    if (!reader) {
      return ''
    }
    let size = 0
    const parts: Uint8Array[] = []
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) {
          break
        }
        size += chunk.value.byteLength
        if (size > 5 * 1024 * 1024) {
          throw new Error('URL document exceeds the 5 MB import limit.')
        }
        parts.push(chunk.value)
      }
    } finally {
      await reader.cancel()
    }
    return decodeDocument(Buffer.concat(parts))
  }
  throw new Error('URL has too many redirects.')
}

export async function openConnectedDocument(
  value: unknown,
  signal?: AbortSignal,
  credentials?: SshCredentials
): Promise<ConnectedDocument> {
  const target = parseTarget(value)
  if (target.kind === 'url') {
    const content = await readUrl(target.url, signal)
    return {
      content,
      location: null,
      path: null,
      name: basename(new URL(target.url).pathname) || 'Imported.md'
    }
  }
  let content: string
  if (target.kind === 'ssh') {
    content = await readSshFile(target, credentials, signal)
  } else {
    const info = await stat(target.path)
    if (!info.isFile() || info.size > 5 * 1024 * 1024) {
      throw new Error('Choose a regular text file smaller than 5 MB.')
    }
    const parts: Buffer[] = []
    let size = 0
    const stream = createReadStream(target.path, { signal })
    for await (const chunk of stream) {
      const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      size += part.length
      if (size > 5 * 1024 * 1024) {
        stream.destroy()
        throw new Error('Document exceeds the 5 MB connection limit.')
      }
      parts.push(part)
    }
    content = decodeDocument(Buffer.concat(parts))
  }
  if (content.includes('\0')) {
    throw new Error('This appears to be a binary file. Choose a UTF-8 text document.')
  }
  return {
    content,
    location: target,
    path: targetLabel(target),
    name: target.path.split(/[\\/]/).pop() || 'Untitled.md'
  }
}

export async function saveConnectedDocument(
  value: unknown,
  content: unknown,
  expectedContent: unknown,
  signal?: AbortSignal,
  credentials?: SshCredentials
): Promise<string> {
  const target = parseTarget(value)
  if (target.kind !== 'ssh' || typeof content !== 'string' || typeof expectedContent !== 'string') {
    throw new Error('Invalid remote save request.')
  }
  await writeSshFile(target, content, expectedContent, credentials, signal)
  return targetLabel(target)
}
