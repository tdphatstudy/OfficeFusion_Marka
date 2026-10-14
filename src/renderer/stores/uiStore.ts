import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark' | 'system'

interface UIState {
  theme: Theme
  sidebarOpen: boolean
  sidebarWidth: number

  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
}

export const useUIStore = create<UIState>()(
  persist(
    set => ({
      theme: 'system',
      sidebarOpen: true,
      sidebarWidth: 240,

      setTheme: theme => set({ theme }),
      toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarWidth: width => set({ sidebarWidth: width })
    }),
    { name: 'marka-ui' }
  )
)
