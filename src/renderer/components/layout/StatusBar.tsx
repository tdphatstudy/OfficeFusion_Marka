import { useDeferredValue, useMemo, type FC } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { countWords, estimateReadingTime } from '@/lib/utils'
import { Separator } from '@/components/ui'
import { useUIStore } from '@/stores/uiStore'
import { changeViewMode } from '@/lib/commands'

const StatusBar: FC = () => {
  const content = useEditorStore(state => state.content)
  const filePath = useEditorStore(state => state.filePath)
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
  const modeLabels = { rich: 'Rich editor', split: 'Split view', source: 'Source mode' }

  const toggleMode = (): void => {
    changeViewMode(viewMode === 'rich' ? 'source' : 'rich')
  }

  return (
    <div className="flex h-6 select-none items-center gap-2 border-t border-border bg-surface-raised px-3 text-[11px] text-text-muted">
      <span className={isDirty ? 'text-amber-500' : 'text-text-muted'}>{saveStatus}</span>

      <Separator orientation="vertical" className="h-3" />

      <span>{words.toLocaleString()} words</span>
      <Separator orientation="vertical" className="h-3" />
      <span>{readingTime} min read</span>

      <span className="flex-1" />

      {filePath ? (
        <span className="max-w-xs truncate opacity-60" title={filePath}>
          {filePath}
        </span>
      ) : null}

      <Separator orientation="vertical" className="h-3" />
      <span>UTF-8</span>
      <Separator orientation="vertical" className="h-3" />
      <button
        type="button"
        onClick={toggleMode}
        className="font-medium text-accent hover:underline"
      >
        {modeLabels[viewMode]}
      </button>
    </div>
  )
}

export default StatusBar
