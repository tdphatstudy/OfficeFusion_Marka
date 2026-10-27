import { createHash } from 'node:crypto'
import { stat } from 'node:fs/promises'
import ssh2, { type ConnectConfig } from 'ssh2'
import { decodeDocument } from './document'
import type { SshCredentials, SshLocation } from '../../shared/connections'
import { readEditable } from '../files'
import type { BrowserEntry } from '../../shared/browser'

export function quoteRemotePath(path: string): string {
  const quote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`
  return path.startsWith('~/') ? `"$HOME"/${quote(path.slice(2))}` : quote(path)
}

export async function sshConfig(
  target: SshLocation,
  credentials?: SshCredentials
): Promise<ConnectConfig> {
  if (
    !target.username ||
    !target.fingerprint ||
    !/^SHA256:[A-Za-z0-9+/]{43}$/.test(target.fingerprint)
  ) {
    throw new Error('SSH requires a username and a verified SHA256 host fingerprint.')
  }
  if (!credentials || typeof credentials !== 'object') {
    throw new Error('Enter a password or explicitly choose an SSH key to connect.')
  }
  const config: ConnectConfig = {
    host: target.host.replace(/^\[|\]$/g, ''),
    port: target.port ?? 22,
    username: target.username,
    readyTimeout: 15_000,
    keepaliveInterval: 10_000,
    keepaliveCountMax: 1,
    hostVerifier: (key: Buffer) =>
      `SHA256:${createHash('sha256').update(key).digest('base64').replace(/=+$/, '')}` ===
      target.fingerprint
  }
  if (credentials.method === 'password') {
    if (
      typeof credentials.password !== 'string' ||
      !credentials.password ||
      credentials.password.length > 4096
    ) {
      throw new Error('Enter a valid SSH password.')
    }
    config.password = credentials.password
    config.authHandler = ['password']
  } else if (credentials.method === 'key') {
    if (
      typeof credentials.keyPath !== 'string' ||
      !credentials.keyPath ||
      /[\x00-\x1f]/.test(credentials.keyPath)
    ) {
      throw new Error('Choose the SSH private key explicitly.')
    }
    if (
      credentials.passphrase !== undefined &&
      (typeof credentials.passphrase !== 'string' || credentials.passphrase.length > 4096)
    ) {
      throw new Error('Invalid key passphrase.')
    }
    const info = await stat(credentials.keyPath)
    if (!info.isFile() || info.size > 1024 * 1024) {
      throw new Error('Choose a private key file smaller than 1 MB.')
    }
    const key = Buffer.from((await readEditable(credentials.keyPath)).content)
    if (key.length > 1024 * 1024) {
      throw new Error('Choose a private key file smaller than 1 MB.')
    }
    config.privateKey = key
    config.passphrase = credentials.passphrase || undefined
    config.authHandler = ['publickey']
  } else {
    throw new Error('Choose password or SSH key authentication.')
  }
  return config
}

async function execute(
  target: SshLocation,
  command: string,
  credentials?: SshCredentials,
  signal?: AbortSignal,
  input?: string
): Promise<Buffer> {
  const config = await sshConfig(target, credentials)
  signal?.throwIfAborted()
  return new Promise((resolve, reject) => {
    const client = new ssh2.Client()
    const parts: Buffer[] = []
    let size = 0
    let stderr = ''
    let settled = false
    const finish = (error?: Error): void => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      client.destroy()
      if (error) {
        reject(error)
      } else {
        resolve(Buffer.concat(parts))
      }
    }
    const abort = (): void => finish(new Error('Connection cancelled.'))
    const timer = setTimeout(() => finish(new Error('SSH connection timed out.')), 30_000)
    signal?.addEventListener('abort', abort, { once: true })
    client.on('error', error => finish(new Error(`SSH: ${error.message}`)))
    client.on('close', () => finish(new Error('SSH disconnected before confirming the operation.')))
    client.on('ready', () => {
      client.exec(command, (error, stream) => {
        if (error) {
          finish(error)
          return
        }
        stream.on('error', (error: Error) => finish(error))
        stream.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > 5 * 1024 * 1024) {
            finish(new Error('SSH document exceeds the 5 MB limit.'))
          } else {
            parts.push(chunk)
          }
        })
        stream.stderr.on('data', (chunk: Buffer) => {
          stderr = (stderr + chunk.toString()).slice(0, 4096)
        })
        stream.on('close', (code: number | null) => {
          if (code !== 0) {
            finish(
              new Error(stderr.trim() || 'SSH command failed without a successful exit status.')
            )
          } else {
            finish()
          }
        })
        stream.end(input ?? '')
      })
    })
    try {
      client.connect(config)
    } catch (error: unknown) {
      finish(error instanceof Error ? error : new Error('SSH connection failed.'))
    }
  })
}

export function sshSaveCommand(target: SshLocation, expectedContent: string): string {
  const digest = createHash('sha256').update(expectedContent).digest('hex')
  const check = `h=$(sha256sum < "$p") || exit 74; [ "\${h%% *}" = '${digest}' ] || { printf 'File changed on the server. Save As a local copy or reopen before saving.' >&2; exit 73; }`
  return `p=${quoteRemotePath(target.path)}; [ -f "$p" ] && [ ! -L "$p" ] || { printf 'Remote save requires an existing regular file, not a symlink.' >&2; exit 74; }; ${check}; t=$(mktemp -- "\${p}.marka.XXXXXX") || exit 74; trap 'rm -f -- "$t"' EXIT HUP INT TERM; cat > "$t" || exit 74; ${check}; cp --attributes-only --preserve=mode,ownership -- "$p" "$t" && mv -f -- "$t" "$p"`
}

export async function readSshFile(
  target: SshLocation,
  credentials?: SshCredentials,
  signal?: AbortSignal
): Promise<string> {
  return decodeDocument(
    await execute(target, `cat -- ${quoteRemotePath(target.path)}`, credentials, signal)
  )
}

export async function readSshDirectory(
  target: SshLocation,
  credentials: SshCredentials,
  signal: AbortSignal
): Promise<{ entries: BrowserEntry[]; truncated: boolean }> {
  const output = await execute(
    target,
    `p=${quoteRemotePath(target.path)}; [ -d "$p" ] && [ -r "$p" ] && [ -x "$p" ] || { printf 'Cannot browse this directory.' >&2; exit 74; }; find -- "$p" -mindepth 1 -maxdepth 1 \\( -type f -o -type d \\) -printf '%y\\0%f\\0' | head -z -n 20002`,
    credentials,
    signal
  )
  const fields = new TextDecoder('utf-8', { fatal: true }).decode(output).split('\0')
  const entries: BrowserEntry[] = []
  for (let index = 0; index + 1 < fields.length && entries.length < 10000; index += 2) {
    const name = fields[index + 1]
    if (!name || /[/\x00-\x1f\x7f]/.test(name) || !['d', 'f'].includes(fields[index] ?? '')) {
      continue
    }
    entries.push({
      name,
      path: `${target.path === '/' ? '' : target.path}/${name}`,
      directory: fields[index] === 'd'
    })
  }
  return { entries, truncated: fields.length > 20001 }
}

export async function readSshHome(
  target: SshLocation,
  credentials: SshCredentials,
  signal: AbortSignal
): Promise<string> {
  const home = (await execute(target, 'printf %s "$HOME"', credentials, signal)).toString('utf8')
  if (!home.startsWith('/') || home.length > 4096 || /[\x00-\x1f\x7f]/.test(home)) {
    throw new Error('The server did not return a valid home directory.')
  }
  return home
}

export async function writeSshFile(
  target: SshLocation,
  content: string,
  expectedContent: string,
  credentials?: SshCredentials,
  signal?: AbortSignal
): Promise<void> {
  if (Buffer.byteLength(content, 'utf8') > 5 * 1024 * 1024) {
    throw new Error('Document exceeds the 5 MB SSH limit. Save As a local copy.')
  }
  await execute(target, sshSaveCommand(target, expectedContent), credentials, signal, content)
}
