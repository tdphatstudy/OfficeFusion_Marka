import { useDeferredValue, useMemo, type FC } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { countWords } from '@/lib/utils'
import { Separator } from '@/components/ui'
import { useUIStore } from '@/stores/uiStore'
import { changeViewMode } from '@/lib/commands'

const StatusBar: FC = () => {
  const content = useEditorStore(state => state.content)
  const filePath = useEditorStore(state => state.filePath)
  const location = useEditorStore(state => state.fileLocation)
  const isDirty = useEditorStore(state => state.isDirty)
  const viewMode = useEditorStore(state => state.viewMode)
  const paged = useEditorStore(state => state.pagedDocument)
  const fileBusy = useUIStore(state => state.fileBusy)
  const deferredContent = useDeferredValue(content)
  const statisticsPaused = deferredContent.length > 256 * 1024
  const words = useMemo(
    () => (statisticsPaused ? 0 : countWords(deferredContent)),
    [deferredContent, statisticsPaused]
  )
  const readingTime = Math.max(1, Math.ceil(words / 200))
  let statistics = `${words.toLocaleString()} words`
  if (statisticsPaused) {
    statistics = 'Statistics paused'
  }
  if (paged) {
    statistics = `${(paged.size / 1024 / 1024).toFixed(1)} MiB`
  }
  let saveStatus = filePath ? '✓ Saved locally' : 'Local document'
  if (location?.kind === 'ssh') {
    saveStatus = '✓ Saved to host'
  }
  if (isDirty) {
    saveStatus = '● Unsaved changes'
  }
  if (fileBusy) {
    saveStatus = 'Working…'
  }
  if (paged) {
    saveStatus = 'Read-only viewer'
  }
  const modeLabels = { rich: 'Write mode', split: 'Split view', source: 'Markdown mode' }

  const toggleMode = (): void => {
    changeViewMode(viewMode === 'rich' ? 'source' : 'rich')
  }

  return (
    <div className="statusbar flex h-6 shrink-0 select-none items-center gap-2 border-t border-border bg-surface-raised px-3 text-[11px] text-text-muted">
      <span className={isDirty ? 'shrink-0 text-accent' : 'shrink-0 text-text-muted'}>
        {saveStatus}
      </span>

      <Separator orientation="vertical" className="h-3" />

      <span className="shrink-0">{statistics}</span>
      <Separator orientation="vertical" className="statusbar-reading h-3" />
      <span className="statusbar-reading shrink-0">
        {paged || statisticsPaused ? 'Large document' : `${readingTime} min read`}
      </span>

      {location?.kind === 'ssh' && (
        <button
          type="button"
          onClick={() => useUIStore.getState().setConnectionsOpen(true)}
          className="shrink-0 font-medium text-accent"
          title="Open connection hub"
        >
          SSH · {location.host}
        </button>
      )}

      {filePath?.startsWith('\\\\wsl.localhost\\') && (
        <span className="shrink-0 font-medium text-accent">WSL · {filePath.split('\\')[3]}</span>
      )}
      {filePath ? (
        <span className="min-w-0 flex-1 truncate pl-2" title={filePath}>
          {filePath}
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate pl-2">Not saved to a file</span>
      )}

      <Separator orientation="vertical" className="h-3" />
      <span className="shrink-0">UTF-8</span>
      <Separator orientation="vertical" className="h-3" />
      <button
        type="button"
        onClick={toggleMode}
        disabled={paged !== null}
        className="shrink-0 font-medium text-text-secondary hover:underline"
      >
        {paged ? 'Read-only' : modeLabels[viewMode]}
      </button>
    </div>
  )
}

export default StatusBar
