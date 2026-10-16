import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { preferenceStorage } from '@/lib/preferenceStorage'

type Theme = 'light' | 'dark' | 'system'

interface UIState {
  theme: Theme
  sidebarOpen: boolean
  compactSidebarOpen: boolean
  sidebarWidth: number
  commandOpen: boolean
  connectionsOpen: boolean
  settingsOpen: boolean
  focusMode: boolean
  fileBusy: boolean
  findRequested: boolean
  notice: { message: string; error: boolean } | null

  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  setSidebarWidth: (width: number) => void
  setCommandOpen: (open: boolean) => void
  setConnectionsOpen: (open: boolean) => void
  setSettingsOpen: (open: boolean) => void
  toggleFocusMode: () => void
  setFileBusy: (busy: boolean) => void
  setFindRequested: (requested: boolean) => void
  notify: (message: string, error?: boolean) => void
  dismissNotice: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    set => ({
      theme: 'system',
      sidebarOpen: true,
      compactSidebarOpen: false,
      sidebarWidth: 240,
      commandOpen: false,
      connectionsOpen: false,
      settingsOpen: false,
      focusMode: false,
      fileBusy: false,
      findRequested: false,
      notice: null,

      setTheme: theme => set({ theme }),
      toggleSidebar: () =>
        set(state =>
          window.matchMedia('(max-width: 900px)').matches
            ? { compactSidebarOpen: !state.compactSidebarOpen }
            : { sidebarOpen: !state.sidebarOpen }
        ),
      setSidebarWidth: width => set({ sidebarWidth: Math.max(200, Math.min(360, width)) }),
      setCommandOpen: commandOpen => set({ commandOpen }),
      setConnectionsOpen: connectionsOpen => set({ connectionsOpen }),
      setSettingsOpen: settingsOpen => set({ settingsOpen }),
      toggleFocusMode: () => set(state => ({ focusMode: !state.focusMode })),
      setFileBusy: fileBusy => set({ fileBusy }),
      setFindRequested: findRequested => set({ findRequested }),
      notify: (message, error = false) => set({ notice: { message, error } }),
      dismissNotice: () => set({ notice: null })
    }),
    {
      name: 'marka-ui',
      storage: preferenceStorage,
      partialize: state => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        sidebarWidth: state.sidebarWidth
      })
    }
  )
)
