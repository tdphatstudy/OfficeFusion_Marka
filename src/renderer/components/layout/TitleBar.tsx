import type { FC } from 'react'
import {
  Minus,
  Square,
  X,
  FolderOpen,
  Save,
  PenTool,
  Code2,
  Maximize2,
  Minimize2,
  ListTree
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'
import { useFileActions } from '@/hooks/useFileActions'
import { Button, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui'

const TitleBar: FC = () => {
  const { fileName, isDirty, viewMode, setViewMode, config, toggleFullWidth } = useEditorStore()
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const { open, save } = useFileActions()
  const isMac = navigator.userAgent.includes('Mac')

  return (
    <div
      className={cn(
        'drag-region flex h-10 items-center justify-between border-b border-border bg-surface-raised px-2',
        isMac ? 'pl-20' : 'pl-2'
      )}
    >
      <div className="no-drag flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={open}
              className="h-7 gap-1 px-2 text-xs text-text-secondary hover:text-text-primary"
            >
              <FolderOpen size={13} />
              <span>Open</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Open Markdown file</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={save}
              className="h-7 gap-1 px-2 text-xs text-text-secondary hover:text-text-primary"
            >
              <Save size={13} />
              <span>Save</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Save changes</TooltipContent>
        </Tooltip>

        <div className="mx-1 h-3.5 w-px bg-border" />

        <div className="flex items-center rounded-md border border-border bg-surface p-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(): void => setViewMode('rich')}
                className={cn(
                  'flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors',
                  viewMode === 'rich'
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <PenTool size={11} />
                <span>Rich</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Notion-style Rich Block Editor</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={(): void => setViewMode('source')}
                className={cn(
                  'flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors',
                  viewMode === 'source'
                    ? 'bg-accent text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <Code2 size={11} />
                <span>Source</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>Raw Markdown Source</TooltipContent>
          </Tooltip>
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleFullWidth}
              className="flex h-6 w-6 items-center justify-center rounded text-text-secondary hover:bg-surface hover:text-text-primary"
            >
              {config.fullWidth ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {config.fullWidth ? 'Constrain Page Width' : 'Full Width Canvas'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleSidebar}
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded text-text-secondary hover:bg-surface hover:text-text-primary',
                sidebarOpen && 'bg-surface text-accent'
              )}
            >
              <ListTree size={12} />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {sidebarOpen ? 'Hide Outline & Stats' : 'Show Outline & Stats'}
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <div className="flex h-4 w-4 items-center justify-center rounded bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 shadow-xs">
          <div className="h-1.5 w-1.5 rotate-45 rounded-xs bg-white" />
        </div>
        <span className="font-medium text-text-primary">
          {isDirty ? '● ' : ''}
          {fileName}
        </span>
        <span className="text-[11px] text-text-muted">— Marka</span>
      </div>

      {!isMac ? (
        <div className="no-drag flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-10 rounded-none text-text-muted hover:bg-surface-overlay"
            onClick={(): void => window.api.minimize()}
            aria-label="Minimize"
          >
            <Minus size={13} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-10 rounded-none text-text-muted hover:bg-surface-overlay"
            onClick={(): void => window.api.maximize()}
            aria-label="Maximize"
          >
            <Square size={12} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-10 rounded-none text-text-muted hover:bg-red-600 hover:text-white"
            onClick={(): void => window.api.close()}
            aria-label="Close"
          >
            <X size={13} />
          </Button>
        </div>
      ) : (
        <div className="w-16" />
      )}
    </div>
  )
}

export default TitleBar
