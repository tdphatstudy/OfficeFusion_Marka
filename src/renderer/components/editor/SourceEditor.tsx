import type { ChangeEvent, FC } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { cn } from '@/lib/utils'

export const SourceEditor: FC = () => {
  const { content, setContent, config } = useEditorStore()

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    setContent(e.target.value)
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-surface p-4">
      <div
        className={cn(
          'flex h-full w-full flex-1 flex-col rounded-lg border border-border bg-surface-raised p-4 transition-all',
          config.fullWidth ? 'max-w-full' : 'mx-auto max-w-4xl'
        )}
      >
        <div className="mb-2 flex items-center justify-between border-b border-border pb-2 text-xs text-text-muted">
          <span className="font-mono">Raw Markdown Source</span>
          <span>UTF-8</span>
        </div>
        <textarea
          value={content}
          onChange={handleChange}
          spellCheck={false}
          className={cn(
            'flex-1 resize-none bg-transparent font-mono text-sm leading-relaxed text-text-primary focus:outline-none',
            config.wordWrap ? 'whitespace-pre-wrap' : 'whitespace-pre'
          )}
        />
      </div>
    </div>
  )
}
