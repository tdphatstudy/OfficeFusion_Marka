import type { FC } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { countWords, estimateReadingTime } from '@/lib/utils'
import { Separator } from '@/components/ui'

const StatusBar: FC = () => {
  const { content, filePath, isDirty, viewMode, setViewMode } = useEditorStore()
  const words = countWords(content)
  const readingTime = estimateReadingTime(content)

  const toggleMode = (): void => {
    setViewMode(viewMode === 'rich' ? 'source' : 'rich')
  }

  return (
    <div className="flex h-6 select-none items-center gap-2 border-t border-border bg-surface-raised px-3 text-[11px] text-text-muted">
      <span className={isDirty ? 'text-amber-500' : 'text-text-muted'}>
        {isDirty ? '● Modified' : '✓ Saved'}
      </span>

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
        {viewMode === 'rich' ? 'Notion Canvas' : 'Source Mode'}
      </button>
    </div>
  )
}

export default StatusBar
