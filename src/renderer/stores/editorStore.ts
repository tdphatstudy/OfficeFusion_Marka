import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { readDraft } from '@/lib/draft'
import { preferenceStorage } from '@/lib/preferenceStorage'
import { defaultConfig } from '@/lib/preferences'
import type { EditorConfig, ViewMode } from '@/types/editor'
import type { FileLocation } from '../../shared/connections'
import type { PagedDocument } from '../../shared/documents'

interface EditorState {
  content: string
  savedContent: string
  documentId: number
  filePath: string | null
  fileLocation: FileLocation | null
  fileName: string
  isDirty: boolean
  recovered: boolean
  pagedDocument: PagedDocument | null
  viewMode: ViewMode
  config: EditorConfig
  setContent: (content: string) => void
  openFile: (path: string, content: string, location?: FileLocation, paged?: PagedDocument) => void
  markSaved: (path: string, content: string, documentId: number) => void
  setViewMode: (mode: ViewMode) => void
  toggleFullWidth: () => void
  updateConfig: (patch: Partial<EditorConfig>) => void
  newFile: (content?: string, name?: string) => void
  dismissRecovery: () => void
}

const welcome =
  '# Welcome to Marka\n\nMarkdown editor by OfficeFusion.\n\nOpen a document from the File menu, or start writing here.\n\nUse Markdown to edit source, Split to preview, and Commands to find available actions.\n'
const draft = readDraft()

export const useEditorStore = create<EditorState>()(
  persist(
    set => ({
      content: draft?.content ?? welcome,
      savedContent: draft?.savedContent ?? welcome,
      documentId: 0,
      filePath: draft?.filePath ?? null,
      fileLocation:
        draft?.location ?? (draft?.filePath ? { kind: 'local', path: draft.filePath } : null),
      fileName: draft?.filePath?.split(/[\\/]/).pop() ?? 'Untitled.md',
      isDirty: draft !== null,
      recovered: draft !== null,
      pagedDocument: null,
      viewMode: 'rich',
      config: { ...defaultConfig },
      setContent: content => set(state => ({ content, isDirty: content !== state.savedContent })),
      openFile: (path, content, location, paged) =>
        set(state => ({
          documentId: state.documentId + 1,
          filePath: path,
          fileLocation: location ?? { kind: 'local', path },
          fileName: path.split(/[\\/]/).pop() ?? 'Untitled.md',
          content,
          savedContent: content,
          isDirty: false,
          recovered: false,
          pagedDocument: paged ?? null
        })),
      markSaved: (path, content, documentId) =>
        set(state => {
          if (state.documentId !== documentId) {
            return state
          }
          return {
            filePath: path,
            fileLocation:
              state.fileLocation?.kind === 'ssh' && path === state.filePath
                ? state.fileLocation
                : { kind: 'local', path },
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
      newFile: (content = '', name = 'Untitled.md') =>
        set(state => ({
          documentId: state.documentId + 1,
          content,
          savedContent: '',
          filePath: null,
          fileLocation: null,
          fileName: name,
          isDirty: content !== '',
          recovered: false,
          pagedDocument: null
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
