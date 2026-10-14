import type { FC } from 'react'
import { TitleBar, StatusBar } from '@/components/layout'
import { TooltipProvider } from '@/components/ui'
import { useTheme, useKeyboardShortcuts } from '@/hooks'
import { useEditorStore } from '@/stores/editorStore'
import { RichEditor, SourceEditor } from '@/components/editor'

const App: FC = () => {
  useTheme()
  useKeyboardShortcuts()

  const { viewMode } = useEditorStore()

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface text-text-primary">
        <TitleBar />

        <main className="flex flex-1 overflow-hidden">
          {viewMode === 'rich' ? <RichEditor /> : <SourceEditor />}
        </main>

        <StatusBar />
      </div>
    </TooltipProvider>
  )
}

export default App
