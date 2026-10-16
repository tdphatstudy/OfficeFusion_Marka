import { useDeferredValue, useMemo, type FC } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { countWords, estimateReadingTime } from '@/lib/utils'
import { Separator } from '@/components/ui'
import { useUIStore } from '@/stores/uiStore'
import { changeViewMode } from '@/lib/commands'

const StatusBar: FC = () => {
  const content = useEditorStore(state => state.content)
  const filePath = useEditorStore(state => state.filePath)
  const location = useEditorStore(state => state.fileLocation)
  const isDirty = useEditorStore(state => state.isDirty)
  const viewMode = useEditorStore(state => state.viewMode)
  const fileBusy = useUIStore(state => state.fileBusy)
  const deferredContent = useDeferredValue(content)
  const words = useMemo(() => countWords(deferredContent), [deferredContent])
  const readingTime = useMemo(() => estimateReadingTime(deferredContent), [deferredContent])
  let saveStatus = filePath ? '✓ Saved' : 'Local document'
  if (isDirty) {
    saveStatus = '● Unsaved changes'
  }
  if (fileBusy) {
    saveStatus = 'Working…'
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

      <span className="shrink-0">{words.toLocaleString()} words</span>
      <Separator orientation="vertical" className="statusbar-reading h-3" />
      <span className="statusbar-reading shrink-0">{readingTime} min read</span>

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
        className="shrink-0 font-medium text-text-secondary hover:underline"
      >
        {modeLabels[viewMode]}
      </button>
    </div>
  )
}

export default StatusBar
