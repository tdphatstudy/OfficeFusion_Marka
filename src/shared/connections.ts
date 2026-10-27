import type { PagedDocument } from './documents'

export interface SshLocation {
  kind: 'ssh'
  host: string
  username?: string
  port?: number
  fingerprint?: string
  path: string
}

export type SshCredentials =
  { method: 'password'; password: string } | { method: 'key'; keyPath: string; passphrase?: string }

export interface LocalLocation {
  kind: 'local'
  path: string
}

export interface UrlLocation {
  kind: 'url'
  url: string
}

export type FileLocation = LocalLocation | SshLocation
export type ConnectionTarget = FileLocation | UrlLocation

export interface ConnectedDocument {
  content: string
  location: FileLocation | null
  path: string | null
  name: string
  paged?: PagedDocument
}

export interface ConnectionCapabilities {
  platform: string
  sshAvailable: boolean
  wslDistributions: string[]
  wslError: string | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function checkedText(value: unknown, label: string, max = 4096): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max ||
    /[\x00-\x1f\x7f]/.test(value)
  ) {
    throw new Error(`${label} is invalid.`)
  }
  return value
}

export function parseTarget(value: unknown): ConnectionTarget {
  if (!isRecord(value)) {
    throw new Error('Choose a valid connection.')
  }
  if (value.kind === 'local') {
    return { kind: 'local', path: checkedText(value.path, 'File path') }
  }
  if (value.kind === 'url') {
    const url = new URL(checkedText(value.url, 'URL'))
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
      throw new Error('Use an HTTP or HTTPS URL without embedded credentials.')
    }
    return { kind: 'url', url: url.href }
  }
  if (value.kind !== 'ssh') {
    throw new Error('Unsupported connection type.')
  }
  const host = checkedText(value.host, 'SSH host', 253)
  if (!/^(?:[a-zA-Z0-9][a-zA-Z0-9._:-]*|\[[a-fA-F0-9:]+\])$/.test(host)) {
    throw new Error('Enter a hostname or IP address; use the separate username field.')
  }
  const path = checkedText(value.path, 'Remote path')
  if (!path.startsWith('/') && !path.startsWith('~/')) {
    throw new Error('Remote paths must start with / or ~/.')
  }
  const target: SshLocation = { kind: 'ssh', host, path }
  if (value.username !== undefined && value.username !== '') {
    const username = checkedText(value.username, 'Username', 128)
    if (!/^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$/.test(username)) {
      throw new Error('SSH username is invalid.')
    }
    target.username = username
  }
  if (value.port !== undefined) {
    if (
      typeof value.port !== 'number' ||
      !Number.isInteger(value.port) ||
      value.port < 1 ||
      value.port > 65535
    ) {
      throw new Error('Port must be between 1 and 65535.')
    }
    target.port = value.port
  }
  if (value.fingerprint) {
    const fingerprint = checkedText(value.fingerprint, 'Host fingerprint', 60)
    if (!/^SHA256:[A-Za-z0-9+/]{43}$/.test(fingerprint)) {
      throw new Error('Use a SHA256 host fingerprint verified with the server administrator.')
    }
    target.fingerprint = fingerprint
  }
  return target
}

export function targetLabel(target: ConnectionTarget): string {
  if (target.kind === 'url') {
    return target.url
  }
  if (target.kind === 'local') {
    return target.path
  }
  const user = target.username ? `${target.username}@` : ''
  const port = target.port ? `:${target.port}` : ''
  return `ssh://${user}${target.host}${port}${target.path.startsWith('/') ? '' : '/'}${target.path}`
}

export function wslPath(distribution: string, path: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(distribution)) {
    throw new Error('Choose a valid WSL distribution.')
  }
  const checked = checkedText(path, 'Linux path')
  if (
    !checked.startsWith('/') ||
    checked.includes('\\') ||
    checked.split('/').includes('..') ||
    /[<>:"|?*]/.test(checked)
  ) {
    throw new Error(
      'Use an absolute Linux path, for example /home/me/notes.md, without Windows-incompatible characters.'
    )
  }
  return `\\\\wsl.localhost\\${distribution}${checked.replaceAll('/', '\\')}`
}
