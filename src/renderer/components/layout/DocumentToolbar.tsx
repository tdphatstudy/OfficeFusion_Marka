import type { FC, ReactNode } from 'react'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { PanelLeft, Search, Focus, MoreHorizontal } from 'lucide-react'
import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'
import { changeViewMode, findInDocument, richModeLimitation } from '@/lib/commands'
import { cn } from '@/lib/utils'
import { useCompactLayout } from '@/hooks/useCompactLayout'
import { ImagePicker } from '@/components/editor/ImagePicker'

interface DocumentToolbarProps {
  children?: ReactNode
}

const modes = [
  { mode: 'rich', label: 'Write' },
  { mode: 'source', label: 'Markdown' },
  { mode: 'split', label: 'Split' }
] as const

export const DocumentToolbar: FC<DocumentToolbarProps> = ({ children }) => {
  const viewMode = useEditorStore(state => state.viewMode)
  const limitation = useEditorStore(state => richModeLimitation(state.content))
  const fullWidth = useEditorStore(state => state.config.fullWidth)
  const sidebarOpen = useUIStore(state => state.sidebarOpen)
  const compactSidebarOpen = useUIStore(state => state.compactSidebarOpen)
  const focusMode = useUIStore(state => state.focusMode)
  const compact = useCompactLayout()
  const outlineVisible = (compact ? compactSidebarOpen : sidebarOpen) && !focusMode
  const ui = useUIStore.getState()

  return (
    <div className="document-toolbar flex h-10 shrink-0 items-center gap-2 border-b border-border bg-surface px-3">
      <button
        type="button"
        className="toolbar-button"
        aria-label="Toggle outline"
        aria-pressed={outlineVisible}
        title="Toggle outline (Ctrl+Shift+O)"
        onClick={ui.toggleSidebar}
      >
        <PanelLeft size={16} />
      </button>
      <div role="group" aria-label="Editor view" className="flex shrink-0 items-center gap-0.5">
        {modes.map(item => (
          <button
            key={item.mode}
            type="button"
            className={cn('mode-button', viewMode === item.mode && 'mode-button-active')}
            aria-pressed={viewMode === item.mode}
            title={item.mode === 'rich' && limitation ? limitation : `${item.label} mode`}
            disabled={item.mode === 'rich' && limitation !== null}
            onClick={() => changeViewMode(item.mode)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {children && (
        <>
          <div className="toolbar-separator" />
          <div className="min-w-0">{children}</div>
        </>
      )}
      <div className="min-w-0 flex-1" />
      <div className="flex shrink-0 items-center gap-1">
        <ImagePicker />
        <button
          type="button"
          className="toolbar-button"
          aria-label="Toggle focus mode"
          aria-pressed={focusMode}
          title="Focus mode (Ctrl+Shift+F)"
          onClick={ui.toggleFocusMode}
        >
          <Focus size={15} />
        </button>
        <button
          type="button"
          className="find-button flex h-7 items-center gap-1.5 rounded-sm px-2 text-xs text-text-secondary hover:bg-surface-raised"
          aria-label="Find in document"
          title="Find in document (Ctrl+F)"
          onClick={findInDocument}
        >
          <Search size={15} />
          <span>Find</span>
        </button>
        <Menu.Root>
          <Menu.Trigger
            className="toolbar-button"
            aria-label="Document options"
            title="Document options"
          >
            <MoreHorizontal size={17} />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content className="menu-content" sideOffset={5} align="end">
              <Menu.CheckboxItem
                disabled={viewMode !== 'rich'}
                checked={fullWidth}
                className="menu-item"
                onSelect={useEditorStore.getState().toggleFullWidth}
              >
                Toggle page width
              </Menu.CheckboxItem>
              <Menu.Item className="menu-item" onSelect={() => ui.setSettingsOpen(true)}>
                Editor settings<kbd>Ctrl ,</kbd>
              </Menu.Item>
              <Menu.Item className="menu-item" onSelect={() => ui.setCommandOpen(true)}>
                Search commands<kbd>Ctrl K</kbd>
              </Menu.Item>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </div>
  )
}
