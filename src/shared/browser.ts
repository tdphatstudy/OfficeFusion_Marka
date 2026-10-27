import type { SshLocation } from './connections'

export type BrowserSource = { kind: 'local' } | { kind: 'wsl'; distribution: string } | SshLocation

export interface BrowserSession {
  id: string
  label: string
  home: string
  root: string
}

export interface BrowserEntry {
  name: string
  path: string
  directory: boolean
}

export interface BrowserPage {
  path: string
  parent: string | null
  entries: BrowserEntry[]
  truncated: boolean
}

export interface BrowserQuery {
  path: string
  filter: string
  markdownOnly: boolean
  hidden: boolean
  offset: number
}

export function isMarkdownFile(name: string): boolean {
  return /\.(md|markdown|mdown|mdx)$/i.test(name)
}
