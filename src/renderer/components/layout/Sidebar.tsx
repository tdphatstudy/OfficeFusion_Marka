import { useDeferredValue, useMemo, type FC } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useEditorStore } from '@/stores/editorStore'
import { useUIStore } from '@/stores/uiStore'
import { getHeadings } from '@/lib/utils/markdown'
import { navigateToHeading } from '@/lib/editorNavigation'

const Sidebar: FC = () => {
  const content = useEditorStore(state => state.content)
  const deferredContent = useDeferredValue(content)
  const headings = useMemo(() => getHeadings(deferredContent), [deferredContent])

  return (
    <aside
      aria-label="Document outline and details"
      className="outline-panel flex h-full w-56 shrink-0 flex-col border-r border-border bg-surface-raised select-none"
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="flex items-center gap-2 text-xs font-semibold">
          Outline
          <span className="font-normal text-text-muted">{headings.length}</span>
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
      <nav aria-label="Document headings" className="min-h-0 flex-1 overflow-auto px-2 py-3">
        {headings.length === 0 ? (
          <div className="px-1 py-2 text-xs text-text-muted">
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
              className="flex w-full items-center gap-2 rounded-sm py-1.5 pr-2 text-left text-xs text-text-secondary hover:bg-surface-overlay hover:text-text-primary"
              style={{ paddingLeft: 8 + (heading.level - 1) * 12 }}
              title={heading.text}
            >
              <span className="shrink-0 text-[10px] text-text-muted">H{heading.level}</span>
              <span className="truncate">{heading.text}</span>
            </button>
          ))
        )}
      </nav>
      <div className="border-t border-border px-4 py-2 text-[11px] text-text-muted">
        OfficeFusion
      </div>
    </aside>
  )
}

export default Sidebar
