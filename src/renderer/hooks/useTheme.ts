import { useEffect, useState } from 'react'
import { useUIStore } from '@/stores/uiStore'

interface ThemeHook {
  theme: string
  setTheme: (t: 'light' | 'dark' | 'system') => void
}

export function useTheme(): ThemeHook {
  const theme = useUIStore(state => state.theme)
  const setTheme = useUIStore(state => state.setTheme)
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const sync = (): void => setSystemDark(mediaQuery.matches)
    sync()
    mediaQuery.addEventListener('change', sync)
    return (): void => {
      mediaQuery.removeEventListener('change', sync)
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle(
      'dark',
      theme === 'dark' || (theme === 'system' && systemDark)
    )
  }, [theme, systemDark])

  return { theme, setTheme }
}
