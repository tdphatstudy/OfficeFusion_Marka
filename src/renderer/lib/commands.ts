import { fileActions } from '@/lib/fileActions'
import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'
import type { ViewMode } from '@/types/editor'

export function richModeLimitation(content: string): string | null {
  if (content.length > 100_000) {
    return 'Large documents use Source or Split for faster editing.'
  }
  if (
    /^---\r?\n/.test(content) ||
    /\$\$|\$[^$\n]+\$|\[\^[^\]]+\]|^\s*```mermaid\b/m.test(content)
  ) {
    return 'This document uses syntax best preserved in Source or Split (frontmatter, math, footnotes or diagrams).'
  }
  return null
}

export function changeViewMode(mode: ViewMode): void {
  const limitation = mode === 'rich' ? richModeLimitation(useEditorStore.getState().content) : null
  if (limitation) {
    useUIStore.getState().notify(limitation)
    return
  }
  useEditorStore.getState().setViewMode(mode)
}

export function findInDocument(): void {
  const state = useEditorStore.getState()
  useUIStore.getState().setFindRequested(true)
  if (state.viewMode === 'rich') {
    state.setViewMode('source')
  }
  useUIStore.getState().setCommandOpen(false)
}

const meetingNotes =
  '# Meeting notes\n\n## Overview\n\n- Date: \n- Attendees: \n- Objective: \n\n## Discussion\n\n## Decisions\n\n## Action items\n\n- [ ] Task — owner — due date\n'
const projectBrief =
  '# Project brief\n\n## Problem\n\n## Goals\n\n## Scope\n\n### Included\n\n### Out of scope\n\n## Milestones\n\n| Milestone | Owner | Due |\n| --- | --- | --- |\n| Kickoff | | |\n\n## Success criteria\n\n- [ ] \n'

export interface AppCommand {
  id: string
  label: string
  group: string
  shortcut?: string
  run: () => void | Promise<void>
}

export const appCommands: AppCommand[] = [
  {
    id: 'new',
    label: 'New document',
    group: 'File',
    shortcut: 'Mod N',
    run: () => fileActions.newDocument()
  },
  {
    id: 'open',
    label: 'Open Markdown file',
    group: 'File',
    shortcut: 'Mod O',
    run: fileActions.open
  },
  { id: 'save', label: 'Save document', group: 'File', shortcut: 'Mod S', run: fileActions.save },
  {
    id: 'save-as',
    label: 'Save document as…',
    group: 'File',
    shortcut: 'Mod Shift S',
    run: fileActions.saveAs
  },
  {
    id: 'find',
    label: 'Find and replace in source',
    group: 'Edit',
    shortcut: 'Mod F',
    run: findInDocument
  },
  {
    id: 'rich',
    label: 'Rich editor',
    group: 'View',
    shortcut: 'Mod Shift R',
    run: () => changeViewMode('rich')
  },
  {
    id: 'source',
    label: 'Markdown source',
    group: 'View',
    shortcut: 'Mod Shift M',
    run: () => changeViewMode('source')
  },
  {
    id: 'split',
    label: 'Split source and preview',
    group: 'View',
    shortcut: 'Mod \\',
    run: () => changeViewMode('split')
  },
  {
    id: 'outline',
    label: 'Toggle document outline',
    group: 'View',
    shortcut: 'Mod Shift O',
    run: () => useUIStore.getState().toggleSidebar()
  },
  {
    id: 'focus',
    label: 'Toggle focus mode',
    group: 'View',
    shortcut: 'Mod Shift F',
    run: () => useUIStore.getState().toggleFocusMode()
  },
  {
    id: 'settings',
    label: 'Editor settings',
    group: 'Preferences',
    shortcut: 'Mod ,',
    run: () => useUIStore.getState().setSettingsOpen(true)
  },
  {
    id: 'light',
    label: 'Use light theme',
    group: 'Preferences',
    run: () => useUIStore.getState().setTheme('light')
  },
  {
    id: 'dark',
    label: 'Use dark theme',
    group: 'Preferences',
    run: () => useUIStore.getState().setTheme('dark')
  },
  {
    id: 'system',
    label: 'Use system theme',
    group: 'Preferences',
    run: () => useUIStore.getState().setTheme('system')
  },
  {
    id: 'meeting',
    label: 'New meeting notes',
    group: 'Templates',
    run: () => fileActions.newDocument(meetingNotes)
  },
  {
    id: 'brief',
    label: 'New project brief',
    group: 'Templates',
    run: () => fileActions.newDocument(projectBrief)
  }
]
