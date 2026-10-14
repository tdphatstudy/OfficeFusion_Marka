import { useEffect, useCallback } from 'react'
import { useEditorStore } from '@/stores/editorStore'

export function useKeyboardShortcuts(): void {
  const { newFile, setViewMode } = useEditorStore()

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey

      if (mod && e.key === 'n') {
        e.preventDefault()
        newFile()
      }
      if (mod && e.key === '\\') {
        e.preventDefault()
        setViewMode('split')
      }
      if (mod && e.shiftKey && e.key === 'r') {
        e.preventDefault()
        setViewMode('rich')
      }
      if (mod && e.shiftKey && e.key === 's') {
        e.preventDefault()
        setViewMode('source')
      }
    },
    [newFile, setViewMode]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
