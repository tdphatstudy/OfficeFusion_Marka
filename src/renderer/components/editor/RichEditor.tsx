import { useEffect, type FC } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import Placeholder from '@tiptap/extension-placeholder'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import Image from '@tiptap/extension-image'
import { CalloutExtension } from './extensions/CalloutExtension'
import { SlashCommandExtension } from './extensions/SlashCommandExtension'
import { BubbleMenu } from './BubbleMenu'
import { EditorToolbar } from './EditorToolbar'
import { useEditorStore } from '@/stores/editorStore'
import { cn } from '@/lib/utils'

export const RichEditor: FC = () => {
  const content = useEditorStore.getState().content
  const config = useEditorStore(state => state.config)
  const fontFamilies = { mono: 'ui-monospace, monospace', prose: 'Georgia, serif', sans: 'inherit' }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6]
        },
        link: false
      }),
      Markdown.configure({
        html: true,
        tightLists: true,
        bulletListMarker: '-'
      }),
      Placeholder.configure({
        placeholder: "Type '/' for commands or start writing..."
      }),
      Table.configure({
        resizable: true
      }),
      TableRow,
      TableHeader,
      TableCell,
      TaskList,
      TaskItem.configure({
        nested: true
      }),
      Link.configure({
        openOnClick: false
      }),
      Highlight.configure({
        multicolor: true
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph']
      }),
      Image.configure({
        inline: true,
        allowBase64: true
      }),
      CalloutExtension,
      SlashCommandExtension
    ],
    content,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none min-h-[500px] text-text-primary text-[15px] leading-relaxed select-text'
      }
    },
    onUpdate: ({ editor: currentEditor }): void => {
      const markdownStorage = currentEditor.storage.markdown
      if (markdownStorage) {
        useEditorStore.getState().setContent(markdownStorage.getMarkdown())
      }
    }
  })

  useEffect(() => {
    if (!editor) {
      return
    }

    const markdownStorage = editor.storage.markdown
    if (markdownStorage) {
      const currentMd = markdownStorage.getMarkdown()
      if (currentMd !== content) {
        editor.commands.setContent(content, { emitUpdate: false })
      }
    }
  }, [content, editor])

  useEffect(() => {
    const navigate = (event: Event): void => {
      if (!(event instanceof CustomEvent)) {
        return
      }
      const detail: unknown = event.detail
      if (
        typeof detail !== 'object' ||
        detail === null ||
        !('index' in detail) ||
        typeof detail.index !== 'number'
      ) {
        return
      }
      const heading = editor?.view.dom.querySelectorAll('h1, h2, h3, h4, h5, h6')[detail.index]
      heading?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    window.addEventListener('marka:navigate', navigate)
    return () => {
      window.removeEventListener('marka:navigate', navigate)
    }
  }, [editor])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <EditorToolbar editor={editor} />
      <div className="relative flex flex-1 flex-col overflow-y-auto">
        <div
          className={cn(
            'w-full flex-1 transition-all duration-200',
            config.fullWidth ? 'px-10 py-8' : 'mx-auto max-w-3xl px-8 py-8'
          )}
        >
          <BubbleMenu editor={editor} />
          <EditorContent
            editor={editor}
            style={{
              fontSize: config.fontSize,
              lineHeight: config.lineHeight,
              fontFamily: fontFamilies[config.fontFamily]
            }}
          />
        </div>
      </div>
    </div>
  )
}
