import { useMemo, type FC } from 'react'
import { ListTree, FileText, Clock, Hash, ChevronLeft, BookOpen } from 'lucide-react'
import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'
import { ScrollArea } from '@/components/ui'
import { cn } from '@/lib/utils'

interface HeadingItem {
  level: number
  text: string
  index: number
}

const Sidebar: FC = () => {
  const { content, fileName } = useEditorStore()
  const { toggleSidebar } = useUIStore()

  const headings = useMemo<HeadingItem[]>(() => {
    const lines = content.split('\n')
    const result: HeadingItem[] = []
    let hIndex = 0

    for (const line of lines) {
      const match = line.match(/^(#{1,4})\s+(.+)$/)
      if (match && match[1] && match[2]) {
        result.push({
          level: match[1].length,
          text: match[2].trim(),
          index: hIndex++
        })
      }
    }

    return result
  }, [content])

  const stats = useMemo(() => {
    const trimmed = content.trim()
    const words = trimmed ? (trimmed.match(/\S+/g) || []).length : 0
    const characters = content.length
    const readingTime = Math.max(1, Math.ceil(words / 200))
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0).length

    return {
      words,
      characters,
      readingTime,
      paragraphs
    }
  }, [content])

  const scrollToHeading = (index: number): void => {
    const elements = document.querySelectorAll(
      '.tiptap h1, .tiptap h2, .tiptap h3, .tiptap h4, .cm-editor .cm-line'
    )
    const target = elements[index]
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface-raised select-none">
      <div className="flex h-10 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
          <ListTree size={14} className="text-accent" />
          <span>Outline & Details</span>
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex h-6 w-6 items-center justify-center rounded text-text-muted hover:bg-surface-overlay hover:text-text-primary"
          title="Close Outline"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
            <BookOpen size={12} />
            <span>Document Outline</span>
          </div>

          {headings.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-text-muted">
              <p>No headings yet</p>
              <p className="mt-1 text-[11px]">Use # or slash command to add sections</p>
            </div>
          ) : (
            <nav className="space-y-0.5">
              {headings.map(h => (
                <button
                  key={`${h.index}-${h.text}`}
                  type="button"
                  onClick={(): void => scrollToHeading(h.index)}
                  className={cn(
                    'group flex w-full items-center truncate rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-overlay hover:text-accent',
                    h.level === 1 && 'font-semibold text-text-primary text-xs',
                    h.level === 2 && 'pl-4 text-xs font-medium text-text-secondary',
                    h.level === 3 && 'pl-6 text-[11px] text-text-muted',
                    h.level === 4 && 'pl-8 text-[11px] text-text-muted'
                  )}
                  title={h.text}
                >
                  <span className="mr-1.5 text-[10px] text-text-muted group-hover:text-accent">
                    {'#'.repeat(h.level)}
                  </span>
                  <span className="truncate">{h.text}</span>
                </button>
              ))}
            </nav>
          )}

          <div className="my-4 border-t border-border" />

          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-text-muted uppercase">
            <FileText size={12} />
            <span>Statistics</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border border-border bg-surface p-2">
              <div className="text-[10px] text-text-muted">Words</div>
              <div className="mt-0.5 text-sm font-semibold text-text-primary">{stats.words}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-2">
              <div className="text-[10px] text-text-muted">Characters</div>
              <div className="mt-0.5 text-sm font-semibold text-text-primary">
                {stats.characters}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-2">
              <div className="flex items-center gap-1 text-[10px] text-text-muted">
                <Clock size={10} />
                <span>Reading Time</span>
              </div>
              <div className="mt-0.5 text-sm font-semibold text-text-primary">
                {stats.readingTime} min
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface p-2">
              <div className="flex items-center gap-1 text-[10px] text-text-muted">
                <Hash size={10} />
                <span>Headings</span>
              </div>
              <div className="mt-0.5 text-sm font-semibold text-text-primary">
                {headings.length}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-border bg-surface/50 p-2 text-[11px] text-text-muted">
            <div className="truncate font-medium text-text-secondary">{fileName}</div>
            <div className="mt-0.5 text-[10px] text-text-muted">Part of OfficeFusion suite</div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}

export default Sidebar
