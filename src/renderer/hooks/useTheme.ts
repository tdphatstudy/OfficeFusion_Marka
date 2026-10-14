import { useEffect } from 'react'
import { useUIStore } from '@/stores/uiStore'

interface ThemeHook {
  theme: string
  setTheme: (t: 'light' | 'dark' | 'system') => void
}

export function useTheme(): ThemeHook {
  const { theme, setTheme } = useUIStore()

  useEffect(() => {
    const root = document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyTheme = (): void => {
      const isDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches)
      root.classList.toggle('dark', isDark)
    }

    applyTheme()
    mediaQuery.addEventListener('change', applyTheme)
    return (): void => {
      mediaQuery.removeEventListener('change', applyTheme)
    }
  }, [theme])

  return { theme, setTheme }
}
