import { useRef, type FC } from 'react'
import type { Editor } from '@tiptap/core'
import { useEditorState } from '@tiptap/react'
import * as Menu from '@radix-ui/react-dropdown-menu'
import { Bold, Italic, List, ChevronDown, MoreHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TablePicker } from './TablePicker'

interface EditorToolbarProps {
  editor: Editor | null
}

interface FormatAction {
  label: string
  run: () => boolean
  active?: boolean
  disabled?: boolean
}

export const EditorToolbar: FC<EditorToolbarProps> = ({ editor }) => {
  useEditorState({ editor, selector: state => state.transactionNumber })
  const actionSelected = useRef(false)
  if (!editor) {
    return null
  }
  const heading = [1, 2, 3, 4, 5, 6].find(level => editor.isActive('heading', { level }))
  const headingLabel = heading ? `Heading ${heading}` : 'Normal'
  const applyAction = (run: () => boolean): void => {
    actionSelected.current = true
    run()
  }
  const restoreMenuFocus = (event: Event): void => {
    if (actionSelected.current) {
      event.preventDefault()
      actionSelected.current = false
    }
  }
  const actions: FormatAction[] = [
    {
      label: 'Undo (Ctrl+Z)',
      run: () => editor.chain().focus().undo().run(),
      disabled: !editor.can().undo()
    },
    {
      label: 'Redo (Ctrl+Y)',
      run: () => editor.chain().focus().redo().run(),
      disabled: !editor.can().redo()
    },
    {
      label: 'Underline (Ctrl+U)',
      run: () => editor.chain().focus().toggleUnderline().run(),
      active: editor.isActive('underline')
    },
    {
      label: 'Strikethrough',
      run: () => editor.chain().focus().toggleStrike().run(),
      active: editor.isActive('strike')
    },
    {
      label: 'Highlight',
      run: () => editor.chain().focus().toggleHighlight().run(),
      active: editor.isActive('highlight')
    },
    {
      label: 'Inline Code',
      run: () => editor.chain().focus().toggleCode().run(),
      active: editor.isActive('code')
    },
    {
      label: 'Align Left',
      run: () => editor.chain().focus().setTextAlign('left').run(),
      active: editor.isActive({ textAlign: 'left' })
    },
    {
      label: 'Align Center',
      run: () => editor.chain().focus().setTextAlign('center').run(),
      active: editor.isActive({ textAlign: 'center' })
    },
    {
      label: 'Align Right',
      run: () => editor.chain().focus().setTextAlign('right').run(),
      active: editor.isActive({ textAlign: 'right' })
    },
    {
      label: 'Justify',
      run: () => editor.chain().focus().setTextAlign('justify').run(),
      active: editor.isActive({ textAlign: 'justify' })
    },
    {
      label: 'Bullet List',
      run: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive('bulletList')
    },
    {
      label: 'Numbered List',
      run: () => editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive('orderedList')
    },
    {
      label: 'Checklist',
      run: () => editor.chain().focus().toggleTaskList().run(),
      active: editor.isActive('taskList')
    },
    { label: 'Insert Callout Box', run: () => editor.chain().focus().setCallout().run() },
    {
      label: 'Code Block',
      run: () => editor.chain().focus().toggleCodeBlock().run(),
      active: editor.isActive('codeBlock')
    },
    {
      label: 'Quote Block',
      run: () => editor.chain().focus().toggleBlockquote().run(),
      active: editor.isActive('blockquote')
    },
    { label: 'Horizontal Divider', run: () => editor.chain().focus().setHorizontalRule().run() }
  ]
  return (
    <div
      className="editor-toolbar flex items-center gap-1"
      role="group"
      aria-label="Text formatting"
    >
      <Menu.Root
        onOpenChange={open => {
          if (open) {
            actionSelected.current = false
          }
        }}
      >
        <Menu.Trigger
          className="block-style flex h-7 min-w-20 items-center justify-between gap-2 rounded-sm px-2 text-xs text-text-secondary hover:bg-surface-raised"
          aria-label="Block style"
        >
          {headingLabel}
          <ChevronDown size={12} />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content
            className="menu-content"
            sideOffset={5}
            align="start"
            onCloseAutoFocus={restoreMenuFocus}
          >
            <Menu.Item
              className="menu-item"
              onSelect={() => applyAction(() => editor.chain().focus().setParagraph().run())}
            >
              Normal
            </Menu.Item>
            {([1, 2, 3, 4, 5, 6] as const).map(level => (
              <Menu.Item
                key={level}
                className="menu-item"
                onSelect={() =>
                  applyAction(() => editor.chain().focus().toggleHeading({ level }).run())
                }
              >
                Heading {level}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
      <button
        type="button"
        className={cn('toolbar-button', editor.isActive('bold') && 'toolbar-button-active')}
        aria-label="Bold"
        aria-pressed={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={15} />
      </button>
      <button
        type="button"
        className={cn('toolbar-button', editor.isActive('italic') && 'toolbar-button-active')}
        aria-label="Italic"
        aria-pressed={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={15} />
      </button>
      <button
        type="button"
        className={cn(
          'toolbar-button format-secondary',
          editor.isActive('bulletList') && 'toolbar-button-active'
        )}
        aria-label="Bullet List"
        title="Bullet List"
        aria-pressed={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={16} />
      </button>
      <TablePicker editor={editor} />
      <Menu.Root
        onOpenChange={open => {
          if (open) {
            actionSelected.current = false
          }
        }}
      >
        <Menu.Trigger
          className="toolbar-button"
          aria-label="More formatting"
          title="More formatting"
        >
          <MoreHorizontal size={16} />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Content
            className="menu-content max-h-[70vh] overflow-auto"
            sideOffset={5}
            align="start"
            onCloseAutoFocus={restoreMenuFocus}
          >
            <div className="format-compact-headings">
              <Menu.Label className="px-3 py-1 text-[11px] text-text-muted">Block style</Menu.Label>
              <Menu.Item
                className="menu-item"
                onSelect={() => applyAction(() => editor.chain().focus().setParagraph().run())}
              >
                Normal
              </Menu.Item>
              {([1, 2, 3, 4, 5, 6] as const).map(level => (
                <Menu.Item
                  key={level}
                  className="menu-item"
                  onSelect={() =>
                    applyAction(() => editor.chain().focus().toggleHeading({ level }).run())
                  }
                >
                  Heading {level}
                </Menu.Item>
              ))}
              <Menu.Separator className="menu-separator" />
            </div>
            {editor.isActive('table') && (
              <>
                <Menu.Label className="px-3 py-1 text-[11px] text-text-muted">Table</Menu.Label>
                {[
                  { label: 'Add row below', run: () => editor.chain().focus().addRowAfter().run() },
                  {
                    label: 'Add column after',
                    run: () => editor.chain().focus().addColumnAfter().run()
                  },
                  { label: 'Delete row', run: () => editor.chain().focus().deleteRow().run() },
                  {
                    label: 'Delete column',
                    run: () => editor.chain().focus().deleteColumn().run()
                  },
                  { label: 'Delete table', run: () => editor.chain().focus().deleteTable().run() }
                ].map(item => (
                  <Menu.Item
                    key={item.label}
                    className="menu-item"
                    onSelect={() => applyAction(item.run)}
                  >
                    {item.label}
                  </Menu.Item>
                ))}
                <Menu.Separator className="menu-separator" />
              </>
            )}
            {actions.map(action =>
              action.active !== undefined ? (
                <Menu.CheckboxItem
                  key={action.label}
                  className="menu-item"
                  checked={action.active}
                  disabled={action.disabled}
                  onSelect={() => applyAction(action.run)}
                >
                  {action.label}
                </Menu.CheckboxItem>
              ) : (
                <Menu.Item
                  key={action.label}
                  className="menu-item"
                  disabled={action.disabled}
                  onSelect={() => applyAction(action.run)}
                >
                  {action.label}
                </Menu.Item>
              )
            )}
          </Menu.Content>
        </Menu.Portal>
      </Menu.Root>
    </div>
  )
}
