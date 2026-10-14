import { lazy, Suspense, type FC } from 'react'
import { TitleBar, StatusBar, Sidebar } from '@/components/layout'
import { TooltipProvider } from '@/components/ui'
import { useTheme, useKeyboardShortcuts } from '@/hooks'
import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'
import { RichEditor } from '@/components/editor'

const SourceEditor = lazy(() =>
  import('@/components/editor/SourceEditor').then(m => ({ default: m.SourceEditor }))
)

const App: FC = () => {
  useTheme()
  useKeyboardShortcuts()

  const { viewMode } = useEditorStore()
  const { sidebarOpen } = useUIStore()

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface text-text-primary">
        <TitleBar />

        <div className="flex flex-1 overflow-hidden">
          {sidebarOpen && <Sidebar />}
          <main className="flex flex-1 flex-col overflow-hidden">
            {viewMode === 'rich' ? (
              <RichEditor />
            ) : (
              <Suspense
                fallback={
                  <div className="flex flex-1 items-center justify-center text-xs text-text-muted">
                    Loading source mode...
                  </div>
                }
              >
                <SourceEditor />
              </Suspense>
            )}
          </main>
        </div>

        <StatusBar />
      </div>
    </TooltipProvider>
  )
}

export default App
