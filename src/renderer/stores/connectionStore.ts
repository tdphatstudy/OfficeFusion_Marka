import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { parseTarget, targetLabel, type ConnectionTarget } from '../../shared/connections'
import { preferenceStorage } from '@/lib/preferenceStorage'

export interface SavedSource {
  id: string
  name: string
  target: ConnectionTarget
}

interface ConnectionState {
  recent: SavedSource[]
  profiles: SavedSource[]
  remember: (target: ConnectionTarget) => void
  saveProfile: (name: string, target: ConnectionTarget, id?: string) => void
  removeProfile: (id: string) => void
  clearRecent: () => void
}

function readSources(value: unknown, limit: number): SavedSource[] {
  if (!Array.isArray(value)) {
    return []
  }
  const result: SavedSource[] = []
  for (const entry of value.slice(0, limit)) {
    if (
      typeof entry !== 'object' ||
      entry === null ||
      !('id' in entry) ||
      !('name' in entry) ||
      !('target' in entry) ||
      typeof entry.id !== 'string' ||
      typeof entry.name !== 'string'
    ) {
      continue
    }
    try {
      result.push({
        id: entry.id,
        name: entry.name.slice(0, 80),
        target: parseTarget(entry.target)
      })
    } catch {
      continue
    }
  }
  return result
}

export const useConnectionStore = create<ConnectionState>()(
  persist(
    set => ({
      recent: [],
      profiles: [],
      remember: target =>
        set(state => {
          const normalized = parseTarget(target)
          if (normalized.kind === 'url' && new URL(normalized.url).search) {
            return state
          }
          const id = targetLabel(normalized)
          return {
            recent: [
              { id, name: id, target: normalized },
              ...state.recent.filter(item => item.id !== id)
            ].slice(0, 12)
          }
        }),
      saveProfile: (name, target, id) =>
        set(state => {
          const normalized = parseTarget(target)
          if (normalized.kind === 'url' && new URL(normalized.url).search) {
            throw new Error(
              'Import URLs with query parameters directly; they are not saved in profiles or history.'
            )
          }
          const label = name.trim().slice(0, 80) || targetLabel(normalized).slice(0, 80)
          if (id && !state.profiles.some(item => item.id === id)) {
            throw new Error('This saved connection no longer exists. Save it as a new connection.')
          }
          if (state.profiles.some(item => item.name === label && item.id !== id)) {
            throw new Error(
              'A saved connection already uses this name. Choose another name or edit that connection.'
            )
          }
          const profile = { id: id ?? crypto.randomUUID(), name: label, target: normalized }
          if (!id && state.profiles.length >= 8) {
            throw new Error(
              'You have 8 saved connections. Edit or remove one before adding another.'
            )
          }
          return {
            profiles: [profile, ...state.profiles.filter(item => item.id !== id)].slice(0, 8)
          }
        }),
      removeProfile: id =>
        set(state => ({ profiles: state.profiles.filter(item => item.id !== id) })),
      clearRecent: () => set({ recent: [] })
    }),
    {
      name: 'marka-connections-v1',
      storage: preferenceStorage,
      partialize: state => ({ recent: state.recent, profiles: state.profiles }),
      merge: (persisted, current) => {
        if (typeof persisted !== 'object' || persisted === null) {
          return current
        }
        return {
          ...current,
          recent: readSources('recent' in persisted ? persisted.recent : null, 12),
          profiles: readSources('profiles' in persisted ? persisted.profiles : null, 8)
        }
      }
    }
  )
)
