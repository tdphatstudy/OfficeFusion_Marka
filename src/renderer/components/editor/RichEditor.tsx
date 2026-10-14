import { useEffect, useRef, type FC } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import Placeholder from '@tiptap/extension-placeholder'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Underline from '@tiptap/extension-underline'
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
  const { content, setContent, config } = useEditorStore()
  const isInternalUpdate = useRef(false)
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4]
        }
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
      Underline,
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
    editorProps: {
      attributes: {
        class:
          'prose dark:prose-invert max-w-none focus:outline-none min-h-[500px] text-text-primary text-[15px] leading-relaxed select-text'
      }
    },
    onUpdate: ({ editor: currentEditor }): void => {
      isInternalUpdate.current = true
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
      debounceTimer.current = setTimeout(() => {
        const markdownStorage = (
          currentEditor.storage as { markdown?: { getMarkdown: () => string } }
        ).markdown
        if (markdownStorage) {
          const md = markdownStorage.getMarkdown()
          setContent(md)
        }
        isInternalUpdate.current = false
      }, 150)
    }
  })

  useEffect(() => {
    return (): void => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!editor || isInternalUpdate.current) {
      return
    }

    const markdownStorage = (editor.storage as { markdown?: { getMarkdown: () => string } })
      .markdown
    if (markdownStorage) {
      const currentMd = markdownStorage.getMarkdown()
      if (currentMd !== content) {
        editor.commands.setContent(content)
      }
    }
  }, [content, editor])

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
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
