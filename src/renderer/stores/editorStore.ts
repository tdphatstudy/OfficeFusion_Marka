import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist } from 'zustand/middleware'
import type { EditorConfig, ViewMode } from '@/types/editor'

interface EditorState {
  content: string
  filePath: string | null
  fileName: string
  isDirty: boolean
  viewMode: ViewMode
  config: EditorConfig
  setContent: (content: string) => void
  openFile: (path: string, content: string) => void
  markSaved: (path: string) => void
  setViewMode: (mode: ViewMode) => void
  toggleFullWidth: () => void
  updateConfig: (patch: Partial<EditorConfig>) => void
  newFile: () => void
}

export const useEditorStore = create<EditorState>()(
  persist(
    immer(set => ({
      content:
        '# Welcome to Marka\n\nExperience rich Notion-style editing with pure Markdown fidelity.\n\nType `/` anywhere to insert blocks, tables, callouts, or formulas.\n',
      filePath: null,
      fileName: 'Untitled.md',
      isDirty: false,
      viewMode: 'rich',
      config: {
        fontSize: 15,
        lineHeight: 1.65,
        wordWrap: true,
        showLineNumbers: true,
        tabSize: 2,
        theme: 'system',
        fontFamily: 'sans',
        fullWidth: false
      },
      setContent: content =>
        set(state => {
          state.content = content
          state.isDirty = true
        }),
      openFile: (path, content) =>
        set(state => {
          state.filePath = path
          state.fileName = path.split(/[\\/]/).pop() ?? 'Untitled.md'
          state.content = content
          state.isDirty = false
        }),
      markSaved: path =>
        set(state => {
          state.filePath = path
          state.fileName = path.split(/[\\/]/).pop() ?? 'Untitled.md'
          state.isDirty = false
        }),
      setViewMode: mode =>
        set(state => {
          state.viewMode = mode
        }),
      toggleFullWidth: () =>
        set(state => {
          state.config.fullWidth = !state.config.fullWidth
        }),
      updateConfig: patch =>
        set(state => {
          Object.assign(state.config, patch)
        }),
      newFile: () =>
        set(state => {
          state.content = ''
          state.filePath = null
          state.fileName = 'Untitled.md'
          state.isDirty = false
        })
    })),
    {
      name: 'marka-editor',
      partialize: state => ({ config: state.config, viewMode: state.viewMode })
    }
  )
)
