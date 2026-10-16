import { lazy, Suspense, useEffect, useState, useRef, type FC } from 'react'
import { TitleBar, StatusBar, Sidebar } from '@/components/layout'
import { TooltipProvider } from '@/components/ui'
import { useTheme, useKeyboardShortcuts } from '@/hooks'
import { useDocumentLifecycle } from '@/hooks/useDocumentLifecycle'
import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'
import { richModeLimitation } from '@/lib/commands'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { SettingsDialog } from '@/components/layout/SettingsDialog'
import { Notifications } from '@/components/layout/Notifications'
import { ConnectionHub } from '@/components/layout/ConnectionHub'

const RichEditor = lazy(() =>
  import('@/components/editor/RichEditor').then(module => ({ default: module.RichEditor }))
)
const SourceEditor = lazy(() =>
  import('@/components/editor/SourceEditor').then(module => ({ default: module.SourceEditor }))
)
const MarkdownPreview = lazy(() =>
  import('@/components/editor/MarkdownPreview').then(module => ({
    default: module.MarkdownPreview
  }))
)

const EditorWorkspace: FC = () => {
  const viewMode = useEditorStore(state => state.viewMode)
  const documentId = useEditorStore(state => state.documentId)
  const limitation = useEditorStore(state =>
    state.viewMode === 'rich' ? richModeLimitation(state.content) : null
  )
  const [ratio, setRatio] = useState(50)
  const workspace = useRef<HTMLDivElement>(null)
  const effectiveMode = limitation ? 'split' : viewMode

  useEffect(() => {
    if (limitation) {
      useEditorStore.getState().setViewMode('split')
      useUIStore.getState().notify(limitation)
    }
  }, [limitation])

  const split = effectiveMode === 'split'
  return (
    <div
      ref={workspace}
      className="editor-workspace flex min-h-0 min-w-0 flex-1 overflow-hidden"
      data-mode={effectiveMode}
    >
      <Suspense
        fallback={
          <div
            role="status"
            className="flex flex-1 items-center justify-center text-sm text-text-muted"
          >
            Preparing your writing space…
          </div>
        }
      >
        {effectiveMode === 'rich' ? (
          <RichEditor key={documentId} />
        ) : (
          <>
            <div
              className="source-pane flex min-h-0 min-w-0 flex-col overflow-hidden"
              style={{ flexBasis: split ? `${ratio}%` : '100%' }}
            >
              <SourceEditor />
            </div>
            {split && (
              <>
                <div
                  role="separator"
                  tabIndex={0}
                  aria-label="Resize source and preview"
                  aria-orientation="vertical"
                  aria-valuemin={25}
                  aria-valuemax={75}
                  aria-valuenow={ratio}
                  className="split-divider"
                  onKeyDown={event => {
                    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                      event.preventDefault()
                      setRatio(current =>
                        Math.max(25, Math.min(75, current + (event.key === 'ArrowRight' ? 5 : -5)))
                      )
                    }
                  }}
                  onDoubleClick={() => setRatio(50)}
                  onPointerDown={event => {
                    event.currentTarget.setPointerCapture(event.pointerId)
                  }}
                  onPointerMove={event => {
                    if (
                      event.currentTarget.hasPointerCapture(event.pointerId) &&
                      workspace.current
                    ) {
                      const bounds = workspace.current.getBoundingClientRect()
                      setRatio(
                        Math.max(
                          25,
                          Math.min(75, ((event.clientX - bounds.left) / bounds.width) * 100)
                        )
                      )
                    }
                  }}
                  onPointerUp={event => {
                    event.currentTarget.releasePointerCapture(event.pointerId)
                  }}
                />
                <MarkdownPreview key={documentId} />
              </>
            )}
          </>
        )}
      </Suspense>
    </div>
  )
}

const RecoveryBanner: FC = () => {
  const recovered = useEditorStore(state => state.recovered)
  if (!recovered) {
    return null
  }
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 border-b border-border bg-accent/10 px-4 py-2 text-xs"
    >
      <span>Recovered your unsaved draft. Review it and save when ready.</span>
      <button
        type="button"
        onClick={useEditorStore.getState().dismissRecovery}
        className="rounded px-2 py-1 font-medium text-accent"
      >
        Got it
      </button>
    </div>
  )
}

const App: FC = () => {
  useTheme()
  useKeyboardShortcuts()
  useDocumentLifecycle()
  const sidebarOpen = useUIStore(state => state.sidebarOpen)
  const focusMode = useUIStore(state => state.focusMode)

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="flex h-screen w-screen flex-col overflow-hidden bg-surface text-text-primary"
        data-focus-mode={focusMode}
      >
        <TitleBar />
        <RecoveryBanner />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {sidebarOpen && !focusMode && <Sidebar />}
          <main
            aria-label="Document editor"
            className="flex min-w-0 flex-1 flex-col overflow-hidden"
          >
            <EditorWorkspace />
          </main>
        </div>
        <StatusBar />
        <CommandPalette />
        <SettingsDialog />
        <ConnectionHub />
        <Notifications />
      </div>
    </TooltipProvider>
  )
}

export default App
