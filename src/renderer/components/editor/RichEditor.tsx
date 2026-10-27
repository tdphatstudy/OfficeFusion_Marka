import { useEffect, type FC } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import Placeholder from '@tiptap/extension-placeholder'
import { TableHeader, TableCell } from '@tiptap/extension-table'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Link from '@tiptap/extension-link'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { CalloutExtension } from './extensions/CalloutExtension'
import { SlashCommandExtension } from './extensions/SlashCommandExtension'
import { BubbleMenu } from './BubbleMenu'
import { EditorToolbar } from './EditorToolbar'
import { DocumentToolbar } from '@/components/layout/DocumentToolbar'
import { useEditorStore } from '@/stores/editorStore'
import { RichFind } from './RichFind'
import { cn } from '@/lib/utils'
import { publishEditorHistory, subscribeEditorHistory } from '@/lib/editorHistory'
import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { useUIStore } from '@/stores/uiStore'
import { writingFonts } from '../../../shared/fonts'
import { ManagedImage } from './extensions/ManagedImage'
import { ResizableTable, ResizableRow, beginRowResize } from './extensions/ResizableTable'

const richBudget = Extension.create({
  name: 'richBudget',
  addProseMirrorPlugins() {
    const editor = this.editor
    return [
      new Plugin({
        filterTransaction: transaction => {
          if (!transaction.docChanged) {
            return true
          }
          const content: string = editor.storage.markdown.serializer.serialize(transaction.doc)
          let embeddedImage = false
          transaction.doc.descendants(node => {
            if (node.type.name === 'image' && /^(?:data|blob):/i.test(String(node.attrs.src))) {
              embeddedImage = true
            }
            return !embeddedImage
          })
          if (embeddedImage) {
            useUIStore
              .getState()
              .notify(
                'Embedded images are not supported in Write mode. Keep the image reference in Markdown mode.',
                true
              )
            return false
          }
          if (content.length > 100_000 || content.includes('\0') || !content.isWellFormed()) {
            useUIStore
              .getState()
              .notify(
                'Edit rejected: Write mode is limited to 100,000 characters. Switch to Markdown mode for larger text.',
                true
              )
            return false
          }
          return true
        }
      })
    ]
  }
})

export const RichEditor: FC<{ active?: boolean }> = ({ active = true }) => {
  const content = useEditorStore(state => state.content)
  const config = useEditorStore(state => state.config)

  const editor = useEditor({
    extensions: [
      richBudget,
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
      ResizableTable.configure({
        resizable: true
      }),
      ResizableRow,
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
      ManagedImage.configure({
        inline: true,
        allowBase64: false
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
    const insert = (event: Event): void => {
      if (active && event instanceof CustomEvent && typeof event.detail === 'string') {
        editor?.chain().focus().setImage({ src: event.detail, alt: 'Image' }).run()
      }
    }
    window.addEventListener('marka:insert-image', insert)
    return () => window.removeEventListener('marka:insert-image', insert)
  }, [editor, active])

  useEffect(() => {
    if (!editor || !active) {
      return
    }
    const publish = (): void => publishEditorHistory(editor.can().undo(), editor.can().redo())
    publish()
    editor.on('transaction', publish)
    const position = (): void => {
      let index = -1
      editor.state.doc.descendants((node, at) => {
        if (node.type.name === 'heading' && at <= editor.state.selection.from) {
          index++
        }
        return at <= editor.state.selection.from
      })
      window.dispatchEvent(new CustomEvent('marka:position', { detail: { index } }))
    }
    editor.on('selectionUpdate', position)
    const unsubscribe = subscribeEditorHistory(action => {
      if (action === 'undo') {
        editor.chain().focus().undo().run()
      } else {
        editor.chain().focus().redo().run()
      }
    })
    return () => {
      editor.off('transaction', publish)
      editor.off('selectionUpdate', position)
      unsubscribe()
      publishEditorHistory(false, false)
    }
  }, [editor, active])

  useEffect(() => {
    if (!editor || !active) {
      return
    }

    const markdownStorage = editor.storage.markdown
    if (markdownStorage) {
      const currentMd = markdownStorage.getMarkdown()
      if (currentMd !== content) {
        editor.commands.setContent(content, { emitUpdate: false })
      }
    }
  }, [content, editor, active])

  useEffect(() => {
    const navigate = (event: Event): void => {
      if (!active || !(event instanceof CustomEvent)) {
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
  }, [editor, active])

  useEffect(() => {
    const locate = (event: Event): void => {
      if (
        !active ||
        !editor ||
        !(event instanceof CustomEvent) ||
        typeof event.detail?.index !== 'number'
      ) {
        return
      }
      let index = 0
      let target = -1
      editor.state.doc.descendants((node, position) => {
        if (node.type.name === 'image' && index++ === event.detail.index) {
          target = position
        }
      })
      if (target >= 0) {
        editor.chain().focus().setNodeSelection(target).run()
        editor.view.dom
          .querySelector('.managed-image-selected')
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
    window.addEventListener('marka:locate-image', locate)
    return () => window.removeEventListener('marka:locate-image', locate)
  }, [editor, active])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <DocumentToolbar>
        <EditorToolbar editor={editor} />
      </DocumentToolbar>
      {editor && <RichFind editor={editor} active={active} />}
      <div className="writing-canvas relative flex flex-1 flex-col overflow-y-auto">
        <div
          onMouseDownCapture={event => {
            if (editor) {
              beginRowResize(editor.view, event.nativeEvent)
            }
          }}
          className={cn(
            'writing-surface w-full flex-1',
            config.fullWidth ? 'writing-surface-wide' : 'mx-auto'
          )}
        >
          <BubbleMenu editor={editor} />
          <EditorContent
            editor={editor}
            style={{
              fontSize: config.fontSize,
              lineHeight: config.lineHeight,
              fontFamily: writingFonts[config.fontFamily]
            }}
          />
        </div>
      </div>
    </div>
  )
}
