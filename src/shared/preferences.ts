import type { EditorConfig } from './editor'
import { parseTarget } from './connections'

export const defaultConfig: EditorConfig = {
  fontSize: 15,
  lineHeight: 1.65,
  wordWrap: true,
  showLineNumbers: true,
  tabSize: 2,
  theme: 'system',
  fontFamily: 'sans',
  fullWidth: false
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function number(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function safePreferences(name: string, raw: string | null): string | null {
  if (!raw || raw.length > 256 * 1024) {
    return null
  }
  try {
    const root = record(JSON.parse(raw))
    const value = record(root.state)
    let state: Record<string, unknown>
    if (name === 'marka-editor') {
      const config = record(value.config)
      state = {
        viewMode:
          value.viewMode === 'source' || value.viewMode === 'split' ? value.viewMode : 'rich',
        config: {
          fontSize: number(config.fontSize, 15, 12, 24),
          lineHeight: number(config.lineHeight, 1.65, 1.2, 2.4),
          tabSize: Math.round(number(config.tabSize, 2, 1, 8)),
          wordWrap: boolean(config.wordWrap, true),
          showLineNumbers: boolean(config.showLineNumbers, true),
          fullWidth: boolean(config.fullWidth, false),
          theme: ['light', 'dark'].includes(String(config.theme)) ? config.theme : 'system',
          fontFamily: ['mono', 'prose'].includes(String(config.fontFamily))
            ? config.fontFamily
            : 'sans'
        }
      }
    } else if (name === 'marka-ui') {
      state = {
        theme: ['light', 'dark'].includes(String(value.theme)) ? value.theme : 'system',
        sidebarOpen: boolean(value.sidebarOpen, true),
        sidebarWidth: number(value.sidebarWidth, 240, 200, 360)
      }
    } else if (name === 'marka-connections-v1') {
      const sources = (items: unknown, limit: number): unknown[] => {
        if (!Array.isArray(items)) {
          return []
        }
        return items.slice(0, limit).flatMap(item => {
          const source = record(item)
          if (typeof source.id !== 'string' || typeof source.name !== 'string') {
            return []
          }
          try {
            const target = parseTarget(source.target)
            if (target.kind === 'url' && new URL(target.url).search) {
              return []
            }
            return [{ id: source.id.slice(0, 4096), name: source.name.slice(0, 80), target }]
          } catch {
            return []
          }
        })
      }
      state = { recent: sources(value.recent, 12), profiles: sources(value.profiles, 8) }
    } else {
      return null
    }
    return JSON.stringify({ state, version: 0 })
  } catch {
    return null
  }
}
