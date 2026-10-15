import { createJSONStorage } from 'zustand/middleware'

const lastValues = new Map<string, string>()

export const preferenceStorage = createJSONStorage(() => ({
  getItem: (name: string): string | null => {
    try {
      return localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name: string, value: string): void => {
    if (lastValues.get(name) === value) {
      return
    }
    try {
      localStorage.setItem(name, value)
      lastValues.set(name, value)
    } catch {
      lastValues.delete(name)
    }
  },
  removeItem: (name: string): void => {
    lastValues.delete(name)
    try {
      localStorage.removeItem(name)
    } catch {
      return
    }
  }
}))
