import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { readDraft } from '@/lib/draft'
import { preferenceStorage } from '@/lib/preferenceStorage'
import type { EditorConfig, ViewMode } from '@/types/editor'

interface EditorState {
  content: string
  savedContent: string
  documentId: number
  filePath: string | null
  fileName: string
  isDirty: boolean
  recovered: boolean
  viewMode: ViewMode
  config: EditorConfig
  setContent: (content: string) => void
  openFile: (path: string, content: string) => void
  markSaved: (path: string, content: string, documentId: number) => void
  setViewMode: (mode: ViewMode) => void
  toggleFullWidth: () => void
  updateConfig: (patch: Partial<EditorConfig>) => void
  newFile: (content?: string) => void
  dismissRecovery: () => void
}

const welcome =
  '# Welcome to Marka\n\nYour writing space in OfficeFusion.\n\nType `/` to insert a block, or open Commands to explore shortcuts and templates.\n'
const draft = readDraft()

export const useEditorStore = create<EditorState>()(
  persist(
    set => ({
      content: draft?.content ?? welcome,
      savedContent: draft?.savedContent ?? welcome,
      documentId: 0,
      filePath: draft?.filePath ?? null,
      fileName: draft?.filePath?.split(/[\\/]/).pop() ?? 'Untitled.md',
      isDirty: draft !== null,
      recovered: draft !== null,
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
      setContent: content => set(state => ({ content, isDirty: content !== state.savedContent })),
      openFile: (path, content) =>
        set(state => ({
          documentId: state.documentId + 1,
          filePath: path,
          fileName: path.split(/[\\/]/).pop() ?? 'Untitled.md',
          content,
          savedContent: content,
          isDirty: false,
          recovered: false
        })),
      markSaved: (path, content, documentId) =>
        set(state => {
          if (state.documentId !== documentId) {
            return state
          }
          return {
            filePath: path,
            fileName: path.split(/[\\/]/).pop() ?? 'Untitled.md',
            savedContent: content,
            isDirty: state.content !== content,
            recovered: false
          }
        }),
      setViewMode: viewMode => set({ viewMode }),
      toggleFullWidth: () =>
        set(state => ({ config: { ...state.config, fullWidth: !state.config.fullWidth } })),
      updateConfig: patch => set(state => ({ config: { ...state.config, ...patch } })),
      newFile: (content = '') =>
        set(state => ({
          documentId: state.documentId + 1,
          content,
          savedContent: '',
          filePath: null,
          fileName: 'Untitled.md',
          isDirty: content !== '',
          recovered: false
        })),
      dismissRecovery: () => set({ recovered: false })
    }),
    {
      name: 'marka-editor',
      storage: preferenceStorage,
      partialize: state => ({ config: state.config, viewMode: state.viewMode })
    }
  )
)
