import { useDeferredValue, useMemo, type FC } from 'react'
import { ListTree, ChevronLeft, FileText, Search } from 'lucide-react'
import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'
import { countWords, getHeadings } from '@/lib/utils/markdown'
import { navigateToHeading } from '@/lib/editorNavigation'
import { findInDocument } from '@/lib/commands'

const Sidebar: FC = () => {
  const content = useEditorStore(state => state.content)
  const fileName = useEditorStore(state => state.fileName)
  const filePath = useEditorStore(state => state.filePath)
  const deferredContent = useDeferredValue(content)
  const headings = useMemo(() => getHeadings(deferredContent), [deferredContent])
  const words = useMemo(() => countWords(deferredContent), [deferredContent])

  return (
    <aside
      aria-label="Document outline and details"
      className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-surface-raised select-none"
    >
      <div className="flex h-12 shrink-0 items-center justify-between px-4">
        <span className="flex items-center gap-2 text-xs font-semibold">
          <ListTree size={15} className="text-accent" />
          Document
        </span>
        <button
          type="button"
          aria-label="Hide outline"
          className="icon-button"
          onClick={useUIStore.getState().toggleSidebar}
        >
          <ChevronLeft size={15} />
        </button>
      </div>
      <div className="mx-3 rounded-lg border border-border bg-surface p-3">
        <div className="flex items-center gap-2">
          <FileText size={14} className="shrink-0 text-accent" />
          <span className="truncate text-xs font-medium" title={fileName}>
            {fileName}
          </span>
        </div>
        <p className="mt-2 truncate text-[11px] text-text-muted" title={filePath ?? undefined}>
          {filePath ?? 'Local draft · save to choose a location'}
        </p>
      </div>
      <button
        type="button"
        className="mx-3 mt-3 flex items-center gap-2 rounded-md px-2 py-2 text-xs text-text-secondary hover:bg-surface-overlay"
        onClick={findInDocument}
      >
        <Search size={14} />
        Find in document{' '}
        <kbd className="ml-auto text-[10px]">
          {navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'} F
        </kbd>
      </button>
      <div className="px-5 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
        Outline <span className="float-right">{headings.length}</span>
      </div>
      <nav aria-label="Document headings" className="min-h-0 flex-1 overflow-auto px-3 pb-3">
        {headings.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-xs text-text-muted">
            <p>No sections yet</p>
            <p className="mt-2 leading-relaxed">
              Add a heading with # or the block menu to navigate your document.
            </p>
          </div>
        ) : (
          headings.map(heading => (
            <button
              key={`${heading.line}-${heading.index}`}
              type="button"
              onClick={() => navigateToHeading(heading.line, heading.index)}
              className="my-0.5 flex w-full items-center gap-2 rounded-md py-2 pr-2 text-left text-xs text-text-secondary hover:bg-surface-overlay hover:text-accent"
              style={{ paddingLeft: 8 + (heading.level - 1) * 12 }}
              title={heading.text}
            >
              <span className="shrink-0 text-[10px] text-text-muted">H{heading.level}</span>
              <span className="truncate">{heading.text}</span>
            </button>
          ))
        )}
      </nav>
      <div className="border-t border-border p-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-lg font-semibold">{words.toLocaleString()}</p>
            <p className="text-[11px] text-text-muted">words</p>
          </div>
          <div>
            <p className="text-lg font-semibold">{Math.max(1, Math.ceil(words / 200))} min</p>
            <p className="text-[11px] text-text-muted">reading time</p>
          </div>
        </div>
        <p className="mt-4 text-[10px] tracking-wider text-text-muted">MARKA / OFFICEFUSION</p>
      </div>
    </aside>
  )
}

export default Sidebar
