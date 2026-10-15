import { useState, type FC } from 'react'
import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  Code,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  CheckSquare,
  Table as TableIcon,
  AlertCircle,
  Code2,
  Quote,
  Minus,
  Download,
  ListTree,
  ChevronDown,
  FileDown,
  Globe,
  FileText
} from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { exportDocument } from '@/lib/exportDocument'
import { cn } from '@/lib/utils'

interface EditorToolbarProps {
  editor: Editor | null
}

export const EditorToolbar: FC<EditorToolbarProps> = ({ editor }) => {
  const toggleSidebar = useUIStore(state => state.toggleSidebar)
  const sidebarOpen = useUIStore(state => state.sidebarOpen)
  useEditorState({ editor, selector: state => state.transactionNumber })
  const [exportOpen, setExportOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  if (!editor) {
    return null
  }

  const handleExport = async (format: 'pdf' | 'html' | 'txt'): Promise<void> => {
    setExportOpen(false)
    setIsExporting(true)
    try {
      await exportDocument(format)
    } finally {
      setIsExporting(false)
    }
  }

  const getCurrentHeading = (): string => {
    if (editor.isActive('heading', { level: 1 })) {
      return 'H1'
    }
    if (editor.isActive('heading', { level: 2 })) {
      return 'H2'
    }
    if (editor.isActive('heading', { level: 3 })) {
      return 'H3'
    }
    if (editor.isActive('heading', { level: 4 })) {
      return 'H4'
    }
    return 'Normal'
  }

  const currentHeading = getCurrentHeading()

  return (
    <div className="editor-toolbar flex h-10 w-full shrink-0 items-center justify-between border-b border-border bg-surface px-2 select-none">
      <div className="flex items-center gap-0.5 overflow-x-auto py-1">
        <button
          type="button"
          onClick={(): boolean => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="flex h-7 w-7 items-center justify-center rounded text-text-secondary hover:bg-surface-raised disabled:opacity-30"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={13} />
        </button>
        <button
          type="button"
          onClick={(): boolean => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="flex h-7 w-7 items-center justify-center rounded text-text-secondary hover:bg-surface-raised disabled:opacity-30"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={13} />
        </button>

        <div className="mx-1 h-4 w-px bg-border" />

        <div className="flex items-center rounded border border-border bg-surface-raised px-1.5 py-0.5 text-xs">
          <span className="w-12 text-center font-medium text-text-primary">{currentHeading}</span>
          <div className="ml-1 flex gap-0.5">
            <button
              type="button"
              onClick={(): boolean => editor.chain().focus().setParagraph().run()}
              className={cn(
                'rounded px-1 text-[10px] hover:bg-surface',
                currentHeading === 'Normal' && 'font-bold text-accent'
              )}
            >
              P
            </button>
            <button
              type="button"
              onClick={(): boolean => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={cn(
                'rounded px-1 text-[10px] hover:bg-surface',
                currentHeading === 'H1' && 'font-bold text-accent'
              )}
            >
              H1
            </button>
            <button
              type="button"
              onClick={(): boolean => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={cn(
                'rounded px-1 text-[10px] hover:bg-surface',
                currentHeading === 'H2' && 'font-bold text-accent'
              )}
            >
              H2
            </button>
            <button
              type="button"
              onClick={(): boolean => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={cn(
                'rounded px-1 text-[10px] hover:bg-surface',
                currentHeading === 'H3' && 'font-bold text-accent'
              )}
            >
              H3
            </button>
          </div>
        </div>

        <div className="mx-1 h-4 w-px bg-border" />

        <button
          type="button"
          onClick={(): boolean => editor.chain().focus().toggleBold().run()}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded transition-colors',
            editor.isActive('bold')
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
          )}
          title="Bold (Ctrl+B)"
        >
          <Bold size={13} />
        </button>

        <button
          type="button"
          onClick={(): boolean => editor.chain().focus().toggleItalic().run()}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded transition-colors',
            editor.isActive('italic')
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
          )}
          title="Italic (Ctrl+I)"
        >
          <Italic size={13} />
        </button>

        <button
          type="button"
          onClick={(): boolean => editor.chain().focus().toggleUnderline().run()}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded transition-colors',
            editor.isActive('underline')
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
          )}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon size={13} />
        </button>

        <button
          type="button"
          onClick={(): boolean => editor.chain().focus().toggleStrike().run()}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded transition-colors',
            editor.isActive('strike')
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
          )}
          title="Strikethrough"
        >
          <Strikethrough size={13} />
        </button>

        <button
          type="button"
          onClick={(): boolean => editor.chain().focus().toggleHighlight().run()}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded transition-colors',
            editor.isActive('highlight')
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
          )}
          title="Highlight"
        >
          <Highlighter size={13} />
        </button>

        <button
          type="button"
          onClick={(): boolean => editor.chain().focus().toggleCode().run()}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded transition-colors',
            editor.isActive('code')
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
          )}
          title="Inline Code"
        >
          <Code size={13} />
        </button>

        <div className="mx-1 h-4 w-px bg-border" />

        <button
          type="button"
          onClick={(): boolean => editor.chain().focus().setTextAlign('left').run()}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded transition-colors',
            editor.isActive({ textAlign: 'left' })
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
          )}
          title="Align Left"
        >
          <AlignLeft size={13} />
        </button>

        <button
          type="button"
          onClick={(): boolean => editor.chain().focus().setTextAlign('center').run()}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded transition-colors',
            editor.isActive({ textAlign: 'center' })
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
          )}
          title="Align Center"
        >
          <AlignCenter size={13} />
        </button>

        <button
          type="button"
          onClick={(): boolean => editor.chain().focus().setTextAlign('right').run()}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded transition-colors',
            editor.isActive({ textAlign: 'right' })
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
          )}
          title="Align Right"
        >
          <AlignRight size={13} />
        </button>

        <button
          type="button"
          onClick={(): boolean => editor.chain().focus().setTextAlign('justify').run()}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded transition-colors',
            editor.isActive({ textAlign: 'justify' })
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
          )}
          title="Justify"
        >
          <AlignJustify size={13} />
        </button>

        <div className="mx-1 h-4 w-px bg-border" />

        <button
          type="button"
          onClick={(): boolean => editor.chain().focus().toggleBulletList().run()}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded transition-colors',
            editor.isActive('bulletList')
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
          )}
          title="Bullet List"
        >
          <List size={13} />
        </button>

        <button
          type="button"
          onClick={(): boolean => editor.chain().focus().toggleOrderedList().run()}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded transition-colors',
            editor.isActive('orderedList')
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
          )}
          title="Numbered List"
        >
          <ListOrdered size={13} />
        </button>

        <button
          type="button"
          onClick={(): boolean => editor.chain().focus().toggleTaskList().run()}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded transition-colors',
            editor.isActive('taskList')
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
          )}
          title="Checklist"
        >
          <CheckSquare size={13} />
        </button>

        <div className="mx-1 h-4 w-px bg-border" />

        <button
          type="button"
          onClick={(): boolean =>
            editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
          }
          className="flex h-7 w-7 items-center justify-center rounded text-text-secondary hover:bg-surface-raised hover:text-text-primary"
          title="Insert Table (3x3)"
        >
          <TableIcon size={13} />
        </button>

        <button
          type="button"
          onClick={(): boolean => editor.chain().focus().setCallout().run()}
          className="flex h-7 w-7 items-center justify-center rounded text-text-secondary hover:bg-surface-raised hover:text-text-primary"
          title="Insert Callout Box"
        >
          <AlertCircle size={13} />
        </button>

        <button
          type="button"
          onClick={(): boolean => editor.chain().focus().toggleCodeBlock().run()}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded transition-colors',
            editor.isActive('codeBlock')
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
          )}
          title="Code Block"
        >
          <Code2 size={13} />
        </button>

        <button
          type="button"
          onClick={(): boolean => editor.chain().focus().toggleBlockquote().run()}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded transition-colors',
            editor.isActive('blockquote')
              ? 'bg-accent/15 text-accent'
              : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
          )}
          title="Quote Block"
        >
          <Quote size={13} />
        </button>

        <button
          type="button"
          onClick={(): boolean => editor.chain().focus().setHorizontalRule().run()}
          className="flex h-7 w-7 items-center justify-center rounded text-text-secondary hover:bg-surface-raised hover:text-text-primary"
          title="Horizontal Divider"
        >
          <Minus size={13} />
        </button>
      </div>

      <div className="flex items-center gap-1.5 pl-2">
        <button
          type="button"
          onClick={toggleSidebar}
          className={cn(
            'flex h-7 items-center gap-1 rounded px-2 text-xs transition-colors',
            sidebarOpen
              ? 'bg-accent/15 font-medium text-accent'
              : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
          )}
          title={sidebarOpen ? 'Hide Outline' : 'Show Outline & Stats'}
        >
          <ListTree size={13} />
          <span className="hidden sm:inline">Outline</span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={(): void => setExportOpen(!exportOpen)}
            disabled={isExporting}
            className="flex h-7 items-center gap-1 rounded bg-accent px-2.5 text-xs font-medium text-white shadow-xs hover:bg-accent-hover disabled:opacity-50"
            title="Export Document"
          >
            <Download size={12} />
            <span>Export</span>
            <ChevronDown size={11} />
          </button>

          {exportOpen && (
            <div className="absolute right-0 top-8 z-50 w-44 rounded-lg border border-border bg-surface-overlay p-1 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  void handleExport('pdf')
                }}
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-text-primary hover:bg-surface-raised"
              >
                <FileDown size={13} className="text-red-500" />
                <span>Export as PDF</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleExport('html')
                }}
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-text-primary hover:bg-surface-raised"
              >
                <Globe size={13} className="text-blue-500" />
                <span>Export as HTML</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleExport('txt')
                }}
                className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-xs text-text-primary hover:bg-surface-raised"
              >
                <FileText size={13} className="text-emerald-500" />
                <span>Export Plain Text</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
