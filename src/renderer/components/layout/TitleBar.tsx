import type { FC } from 'react'
import * as Menu from '@radix-ui/react-dropdown-menu'
import {
  Minus,
  Square,
  X,
  FolderOpen,
  Save,
  PenTool,
  Code2,
  Columns2,
  ListTree,
  Search,
  Settings2,
  Focus,
  ChevronDown,
  Maximize2
} from 'lucide-react'
import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'
import { fileActions } from '@/lib/fileActions'
import { changeViewMode } from '@/lib/commands'
import { exportDocument } from '@/lib/exportDocument'
import { cn } from '@/lib/utils'

const TitleBar: FC = () => {
  const fileName = useEditorStore(state => state.fileName)
  const isDirty = useEditorStore(state => state.isDirty)
  const viewMode = useEditorStore(state => state.viewMode)
  const fullWidth = useEditorStore(state => state.config.fullWidth)
  const sidebarOpen = useUIStore(state => state.sidebarOpen)
  const focusMode = useUIStore(state => state.focusMode)
  const fileBusy = useUIStore(state => state.fileBusy)
  const isMac = navigator.userAgent.includes('Mac')
  const ui = useUIStore.getState()

  return (
    <header
      className={cn(
        'drag-region flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3',
        isMac && 'pl-20'
      )}
    >
      <Menu.Root>
        <Menu.Trigger
          className="no-drag flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold hover:bg-surface-overlay"
          aria-label="File menu"
        >
          <span className="text-accent">Marka</span>
          <ChevronDown size={12} />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content className="menu-content" sideOffset={8}>
            <Menu.Item
              disabled={fileBusy}
              className="menu-item"
              onSelect={() => {
                void fileActions.newDocument()
              }}
            >
              New document<kbd>Ctrl N</kbd>
            </Menu.Item>
            <Menu.Item
              disabled={fileBusy}
              className="menu-item"
              onSelect={() => {
                void fileActions.open()
              }}
            >
              Open file…<kbd>Ctrl O</kbd>
            </Menu.Item>
            <Menu.Item
              disabled={fileBusy}
              className="menu-item"
              onSelect={() => {
                void fileActions.save()
              }}
            >
              Save<kbd>Ctrl S</kbd>
            </Menu.Item>
            <Menu.Item
              disabled={fileBusy}
              className="menu-item"
              onSelect={() => {
                void fileActions.saveAs()
              }}
            >
              Save as…<kbd>Ctrl Shift S</kbd>
            </Menu.Item>
            <Menu.Separator className="my-1 h-px bg-border" />
            <Menu.Item
              className="menu-item"
              onSelect={() => {
                void exportDocument('pdf')
              }}
            >
              Export PDF
            </Menu.Item>
            <Menu.Item
              className="menu-item"
              onSelect={() => {
                void exportDocument('html')
              }}
            >
              Export HTML
            </Menu.Item>
            <Menu.Item
              className="menu-item"
              onSelect={() => {
                void exportDocument('txt')
              }}
            >
              Export plain text
            </Menu.Item>
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
      <div className="no-drag flex items-center gap-1">
        <button
          type="button"
          className="icon-button"
          disabled={fileBusy}
          onClick={() => {
            void fileActions.open()
          }}
          aria-label="Open file"
          title="Open file (Ctrl+O)"
        >
          <FolderOpen size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          disabled={fileBusy}
          onClick={() => {
            void fileActions.save()
          }}
          aria-label="Save document"
          title="Save (Ctrl+S)"
        >
          <Save size={16} />
        </button>
      </div>
      <div
        className="min-w-0 flex-1 truncate px-2 text-center text-xs font-medium"
        title={fileName}
      >
        <span className={isDirty ? 'text-accent' : 'text-text-muted'}>{isDirty ? '● ' : ''}</span>
        {fileName}
      </div>
      <div className="no-drag flex items-center gap-1">
        <div
          role="group"
          aria-label="Editor view"
          className="mr-2 flex rounded-lg border border-border bg-surface p-1"
        >
          {(
            [
              { mode: 'rich', label: 'Rich', icon: PenTool },
              { mode: 'source', label: 'Source', icon: Code2 },
              { mode: 'split', label: 'Split', icon: Columns2 }
            ] as const
          ).map(item => (
            <button
              key={item.mode}
              type="button"
              onClick={() => changeViewMode(item.mode)}
              aria-label={item.label}
              aria-pressed={viewMode === item.mode}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
                viewMode === item.mode
                  ? 'bg-accent/10 font-semibold text-accent'
                  : 'text-text-secondary hover:bg-surface-raised'
              )}
            >
              <item.icon size={13} />
              <span className="hidden min-[1000px]:inline">{item.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Toggle outline"
          aria-pressed={sidebarOpen && !focusMode}
          onClick={ui.toggleSidebar}
          title="Toggle outline"
        >
          <ListTree size={16} />
        </button>
        <button
          type="button"
          className="icon-button hidden min-[1000px]:flex"
          aria-label="Toggle page width"
          disabled={viewMode !== 'rich'}
          aria-pressed={fullWidth}
          onClick={useEditorStore.getState().toggleFullWidth}
          title="Toggle page width"
        >
          <Maximize2 size={15} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Toggle focus mode"
          aria-pressed={focusMode}
          onClick={ui.toggleFocusMode}
          title="Focus mode (Ctrl+Shift+F)"
        >
          <Focus size={16} />
        </button>
        <button
          type="button"
          className="icon-button"
          aria-label="Editor settings"
          onClick={() => ui.setSettingsOpen(true)}
          title="Settings (Ctrl+,)"
        >
          <Settings2 size={16} />
        </button>
        <button
          type="button"
          className="flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-text-secondary hover:text-accent"
          aria-label="Open commands"
          onClick={() => ui.setCommandOpen(true)}
          title="Commands (Ctrl+K)"
        >
          <Search size={14} />
          <span className="hidden min-[1100px]:inline">Commands</span>
        </button>
      </div>
      {!isMac && (
        <div className="no-drag ml-1 flex items-center border-l border-border pl-1">
          <button
            type="button"
            className="window-button"
            onClick={() => window.api.minimize()}
            aria-label="Minimize"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            className="window-button"
            onClick={() => window.api.maximize()}
            aria-label="Maximize"
          >
            <Square size={12} />
          </button>
          <button
            type="button"
            className="window-button"
            onClick={() => window.api.close()}
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </header>
  )
}

export default TitleBar
