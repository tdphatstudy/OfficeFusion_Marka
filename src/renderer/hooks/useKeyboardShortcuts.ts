import { useEffect } from 'react'
import { appCommands } from '@/lib/commands'
import { useUIStore } from '@/stores/uiStore'

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) {
        return
      }
      if (event.isComposing || event.altKey || !(event.ctrlKey || event.metaKey)) {
        return
      }
      const key = event.key.toLowerCase()
      const ui = useUIStore.getState()
      if (key === 'k' && !event.shiftKey) {
        event.preventDefault()
        if (!ui.settingsOpen) {
          ui.setCommandOpen(!ui.commandOpen)
        }
        return
      }
      if (ui.commandOpen || ui.settingsOpen) {
        return
      }
      const shortcut = `Mod ${event.shiftKey ? 'Shift ' : ''}${key === ',' || key === '\\' ? key : key.toUpperCase()}`
      const command = appCommands.find(item => item.shortcut === shortcut)
      if (command) {
        event.preventDefault()
        void command.run()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])
}
