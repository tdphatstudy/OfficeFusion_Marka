import { useRef, type FC, type ReactNode } from 'react'
import * as Menu from '@radix-ui/react-dropdown-menu'
import {
  Minus,
  Square,
  X,
  FolderOpen,
  Save,
  Search,
  Settings2,
  Globe,
  Sun,
  Moon
} from 'lucide-react'
import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'
import { fileActions } from '@/lib/fileActions'
import { changeViewMode, findInDocument } from '@/lib/commands'
import { exportDocument } from '@/lib/exportDocument'
import { cn } from '@/lib/utils'
import { runEditorHistory, useEditorHistoryStore } from '@/lib/editorHistory'
import { BrandMark } from './BrandMark'

interface AppMenuProps {
  label: string
  children: ReactNode
  onCloseAutoFocus?: (event: Event) => void
}

const AppMenu: FC<AppMenuProps> = ({ label, children, onCloseAutoFocus }) => (
  <Menu.Root>
    <Menu.Trigger className="app-menu-trigger" aria-label={`${label} menu`}>
      {label}
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Content
        className="menu-content"
        sideOffset={2}
        align="start"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {children}
      </Menu.Content>
    </Menu.Portal>
  </Menu.Root>
)

const TitleBar: FC = () => {
  const pendingEditorAction = useRef<(() => void) | null>(null)
  const fileName = useEditorStore(state => state.fileName)
  const isDirty = useEditorStore(state => state.isDirty)
  const readOnly = useEditorStore(state => state.pagedDocument !== null)
  const viewMode = useEditorStore(state => state.viewMode)
  const fullWidth = useEditorStore(state => state.config.fullWidth)
  const sidebarOpen = useUIStore(state => state.sidebarOpen)
  const compactSidebarOpen = useUIStore(state => state.compactSidebarOpen)
  const focusMode = useUIStore(state => state.focusMode)
  const fileBusy = useUIStore(state => state.fileBusy)
  const theme = useUIStore(state => state.theme)
  const canUndo = useEditorHistoryStore(state => state.canUndo)
  const canRedo = useEditorHistoryStore(state => state.canRedo)
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const isMac = navigator.userAgent.includes('Mac')
  const ui = useUIStore.getState()
  const outlineVisible = window.matchMedia('(max-width: 900px)').matches
    ? compactSidebarOpen
    : sidebarOpen

  return (
    <header className="app-header shrink-0">
      <div className={cn('app-titlebar drag-region', isMac && 'pl-20')}>
        <div className="flex min-w-0 items-center gap-2 pl-3">
          <BrandMark />
          <span className="text-xs font-semibold">Marka</span>
        </div>
        <div className="truncate px-3 text-center text-xs text-text-secondary" title={fileName}>
          {isDirty && (
            <span className="mr-1 text-accent" aria-label="Unsaved changes">
              ●
            </span>
          )}
          {fileName}
        </div>
        <div className="no-drag flex justify-end">
          {!isMac && (
            <>
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
                className="window-button window-close"
                onClick={() => window.api.close()}
                aria-label="Close"
              >
                <X size={15} />
              </button>
            </>
          )}
        </div>
      </div>
      <div className="app-menubar flex items-center gap-0.5 border-b border-border px-2">
        <nav aria-label="Application menu" className="flex items-center">
          <AppMenu label="File">
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
              onSelect={() => ui.setConnectionsOpen(true)}
            >
              Open connection…<kbd>Ctrl Shift C</kbd>
            </Menu.Item>
            <Menu.Separator className="menu-separator" />
            <Menu.Item
              disabled={fileBusy || readOnly}
              className="menu-item"
              onSelect={() => {
                void fileActions.save()
              }}
            >
              Save<kbd>Ctrl S</kbd>
            </Menu.Item>
            <Menu.Item
              disabled={fileBusy || readOnly}
              className="menu-item"
              onSelect={() => {
                void fileActions.saveAs()
              }}
            >
              Save as…<kbd>Ctrl Shift S</kbd>
            </Menu.Item>
            <Menu.Separator className="menu-separator" />
            <Menu.Item
              disabled={fileBusy || readOnly}
              className="menu-item"
              onSelect={() => {
                void exportDocument('pdf')
              }}
            >
              Export PDF
            </Menu.Item>
            <Menu.Item
              disabled={fileBusy || readOnly}
              className="menu-item"
              onSelect={() => {
                void exportDocument('html')
              }}
            >
              Export HTML
            </Menu.Item>
            <Menu.Item
              disabled={fileBusy || readOnly}
              className="menu-item"
              onSelect={() => {
                void exportDocument('txt')
              }}
            >
              Export plain text
            </Menu.Item>
          </AppMenu>
          <AppMenu
            label="Edit"
            onCloseAutoFocus={event => {
              const action = pendingEditorAction.current
              pendingEditorAction.current = null
              if (action) {
                event.preventDefault()
                action()
              }
            }}
          >
            <Menu.Item
              disabled={!canUndo}
              className="menu-item"
              onSelect={() => {
                pendingEditorAction.current = () => runEditorHistory('undo')
              }}
            >
              Undo<kbd>Ctrl Z</kbd>
            </Menu.Item>
            <Menu.Item
              disabled={!canRedo}
              className="menu-item"
              onSelect={() => {
                pendingEditorAction.current = () => runEditorHistory('redo')
              }}
            >
              Redo<kbd>Ctrl Shift Z</kbd>
            </Menu.Item>
            <Menu.Separator className="menu-separator" />
            <Menu.Item
              className="menu-item"
              onSelect={() => {
                pendingEditorAction.current = findInDocument
              }}
            >
              Find in document<kbd>Ctrl F</kbd>
            </Menu.Item>
            <Menu.Item className="menu-item" onSelect={() => ui.setCommandOpen(true)}>
              Search commands<kbd>Ctrl K</kbd>
            </Menu.Item>
          </AppMenu>
          <AppMenu label="View">
            <Menu.RadioGroup value={viewMode}>
              <Menu.RadioItem
                value="rich"
                className="menu-item"
                onSelect={() => changeViewMode('rich')}
              >
                Write<kbd>Ctrl Shift R</kbd>
              </Menu.RadioItem>
              <Menu.RadioItem
                value="source"
                className="menu-item"
                onSelect={() => changeViewMode('source')}
              >
                Markdown<kbd>Ctrl Shift M</kbd>
              </Menu.RadioItem>
              <Menu.RadioItem
                value="split"
                className="menu-item"
                onSelect={() => changeViewMode('split')}
              >
                Split<kbd>Ctrl \</kbd>
              </Menu.RadioItem>
            </Menu.RadioGroup>
            <Menu.Separator className="menu-separator" />
            <Menu.CheckboxItem
              checked={outlineVisible && !focusMode}
              className="menu-item"
              onSelect={ui.toggleSidebar}
            >
              Document outline<kbd>Ctrl Shift O</kbd>
            </Menu.CheckboxItem>
            <Menu.CheckboxItem
              checked={focusMode}
              className="menu-item"
              onSelect={ui.toggleFocusMode}
            >
              Focus mode<kbd>Ctrl Shift F</kbd>
            </Menu.CheckboxItem>
            <Menu.CheckboxItem
              checked={fullWidth}
              disabled={viewMode !== 'rich'}
              className="menu-item"
              onSelect={useEditorStore.getState().toggleFullWidth}
            >
              Full width writing
            </Menu.CheckboxItem>
            <Menu.Separator className="menu-separator" />
            <Menu.Label className="px-3 py-1 text-[11px] text-text-muted">Appearance</Menu.Label>
            <Menu.RadioGroup value={theme}>
              <Menu.RadioItem
                value="light"
                className="menu-item"
                onSelect={() => ui.setTheme('light')}
              >
                Light
              </Menu.RadioItem>
              <Menu.RadioItem
                value="dark"
                className="menu-item"
                onSelect={() => ui.setTheme('dark')}
              >
                Dark
              </Menu.RadioItem>
              <Menu.RadioItem
                value="system"
                className="menu-item"
                onSelect={() => ui.setTheme('system')}
              >
                System
              </Menu.RadioItem>
            </Menu.RadioGroup>
            <Menu.Separator className="menu-separator" />
            <Menu.Item className="menu-item" onSelect={() => ui.setSettingsOpen(true)}>
              Editor settings<kbd>Ctrl ,</kbd>
            </Menu.Item>
          </AppMenu>
        </nav>
        <div className="mx-2 h-4 w-px bg-border" />
        <button
          type="button"
          className="menubar-icon"
          disabled={fileBusy}
          onClick={() => {
            void fileActions.open()
          }}
          aria-label="Open file"
          title="Open file (Ctrl+O)"
        >
          <FolderOpen size={15} />
        </button>
        <button
          type="button"
          className="menubar-icon"
          disabled={fileBusy || readOnly}
          onClick={() => {
            void fileActions.save()
          }}
          aria-label="Save document"
          title="Save (Ctrl+S)"
        >
          <Save size={15} />
        </button>
        <button
          type="button"
          className="menubar-icon"
          disabled={fileBusy}
          onClick={() => ui.setConnectionsOpen(true)}
          aria-label="Open connections"
          title="Open WSL, SSH, network or URL"
        >
          <Globe size={15} />
        </button>
        <div className="min-w-2 flex-1" />
        <button
          type="button"
          className="flex h-7 items-center gap-2 rounded-sm px-2 text-xs text-text-secondary hover:bg-surface-overlay"
          aria-label="Open commands"
          onClick={() => ui.setCommandOpen(true)}
          title="Commands (Ctrl+K)"
        >
          <Search size={13} />
          <span>Commands</span>
          <kbd className="hidden text-[10px] text-text-muted min-[1000px]:inline">Ctrl K</kbd>
        </button>
        <button
          type="button"
          className="menubar-icon"
          aria-label={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
          title={isDark ? 'Light mode' : 'Dark mode'}
          onClick={() => ui.setTheme(isDark ? 'light' : 'dark')}
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button
          type="button"
          className="menubar-icon"
          aria-label="Editor settings"
          onClick={() => ui.setSettingsOpen(true)}
          title="Settings (Ctrl+,)"
        >
          <Settings2 size={15} />
        </button>
      </div>
    </header>
  )
}

export default TitleBar
