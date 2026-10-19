import { randomUUID } from 'node:crypto'
import { opendir, realpath } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { isAbsolute, join, relative, sep, dirname, posix } from 'node:path'
import { wslPath, type SshCredentials, type SshLocation } from '../shared/connections'
import {
  isMarkdownFile,
  type BrowserPage,
  type BrowserQuery,
  type BrowserSession
} from '../shared/browser'
import { readSshDirectory, readSshHome } from './connections/ssh'

const exec = promisify(execFile)
const lifetime = 30 * 60_000

export async function wslHome(distribution: string, signal: AbortSignal): Promise<string> {
  wslPath(distribution, '/')
  const { stdout } = await exec(
    join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32', 'wsl.exe'),
    ['-d', distribution, '--exec', 'printenv', 'HOME'],
    { signal, timeout: 15000, maxBuffer: 4096, windowsHide: true }
  )
  const home = stdout.trim()
  wslPath(distribution, home)
  return home
}

export function withinRoot(root: string, path: string): boolean {
  const child = relative(root, path)
  return child === '' || (!isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`))
}

export function checkedBrowserQuery(value: unknown): BrowserQuery {
  if (
    !value ||
    typeof value !== 'object' ||
    !('path' in value) ||
    typeof value.path !== 'string' ||
    value.path.length > 4096 ||
    /[\x00-\x1f\x7f]/.test(value.path) ||
    !('filter' in value) ||
    typeof value.filter !== 'string' ||
    value.filter.length > 200 ||
    !('offset' in value) ||
    typeof value.offset !== 'number' ||
    !Number.isSafeInteger(value.offset) ||
    value.offset < 0 ||
    value.offset > 10000 ||
    !('hidden' in value) ||
    typeof value.hidden !== 'boolean' ||
    !('markdownOnly' in value) ||
    typeof value.markdownOnly !== 'boolean'
  ) {
    throw new Error('Invalid folder request.')
  }
  return {
    path: value.path,
    filter: value.filter,
    offset: value.offset,
    hidden: value.hidden,
    markdownOnly: value.markdownOnly
  }
}

export class FileBrowser {
  readonly session: BrowserSession
  readonly expires = Date.now() + lifetime
  private constructor(
    private root: string,
    home: string,
    label: string,
    readonly ssh?: { target: SshLocation; credentials: SshCredentials }
  ) {
    this.session = { id: randomUUID(), home, root, label }
  }

  static async local(root: string, home = root, label = 'This computer'): Promise<FileBrowser> {
    return new FileBrowser(await realpath(root), await realpath(home), label)
  }

  static async remote(
    target: SshLocation,
    credentials: SshCredentials,
    signal: AbortSignal
  ): Promise<FileBrowser> {
    return new FileBrowser(
      '/',
      await readSshHome(target, credentials, signal),
      `SSH · ${target.host}`,
      { target, credentials }
    )
  }

  async checkedPath(path: string): Promise<string> {
    if (Date.now() > this.expires) {
      throw new Error('Folder session expired. Connect again to continue.')
    }
    if (!path || path.length > 4096 || /[\x00-\x1f\x7f]/.test(path)) {
      throw new Error('Invalid folder path.')
    }
    if (this.ssh) {
      if (!path.startsWith('/') || posix.normalize(path) !== path) {
        throw new Error('Use an absolute remote path.')
      }
      return path
    }
    if (!isAbsolute(path)) {
      throw new Error('Use an absolute folder path.')
    }
    const actual = await realpath(path)
    if (!withinRoot(this.root, actual)) {
      throw new Error('Choose a folder inside the approved location.')
    }
    return actual
  }

  async list(query: BrowserQuery, signal: AbortSignal): Promise<BrowserPage> {
    const path = await this.checkedPath(query.path)
    const entries = []
    let scanned = 0
    let truncated = false
    const accept = (name: string, directory: boolean): boolean =>
      (query.hidden || !name.startsWith('.')) &&
      name.toLowerCase().includes(query.filter.toLowerCase()) &&
      (directory || !query.markdownOnly || isMarkdownFile(name))
    if (this.ssh) {
      const result = await readSshDirectory(
        { ...this.ssh.target, path },
        this.ssh.credentials,
        signal
      )
      for (const entry of result.entries) {
        if (accept(entry.name, entry.directory)) {
          entries.push(entry)
        }
      }
      truncated = result.truncated
    } else {
      const directory = await opendir(path)
      try {
        for await (const entry of directory) {
          signal.throwIfAborted()
          if (++scanned > 10000) {
            truncated = true
            break
          }
          if (/[/\\\x00-\x1f\x7f]/.test(entry.name) || (!entry.isDirectory() && !entry.isFile())) {
            continue
          }
          if (accept(entry.name, entry.isDirectory())) {
            entries.push({
              name: entry.name,
              path: join(path, entry.name),
              directory: entry.isDirectory()
            })
          }
        }
      } finally {
        await directory.close().catch(() => undefined)
      }
    }
    signal.throwIfAborted()
    entries.sort(
      (a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name)
    )
    const parent = this.ssh ? posix.dirname(path) : dirname(path)
    return {
      path,
      parent: parent === path || (!this.ssh && !withinRoot(this.root, parent)) ? null : parent,
      entries: entries.slice(query.offset, query.offset + 200),
      truncated: truncated || entries.length > query.offset + 200
    }
  }
}
