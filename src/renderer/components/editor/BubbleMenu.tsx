import type { FC } from 'react'
import { BubbleMenu as TipTapBubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/core'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  Quote
} from 'lucide-react'
import { Separator } from '@/components/ui'
import { cn } from '@/lib/utils'

interface BubbleMenuProps {
  editor: Editor | null
}

export const BubbleMenu: FC<BubbleMenuProps> = ({ editor }) => {
  if (!editor) {
    return null
  }

  const formatButtons = [
    {
      name: 'bold',
      icon: Bold,
      isActive: editor.isActive('bold'),
      action: (): void => {
        editor.chain().focus().toggleBold().run()
      }
    },
    {
      name: 'italic',
      icon: Italic,
      isActive: editor.isActive('italic'),
      action: (): void => {
        editor.chain().focus().toggleItalic().run()
      }
    },
    {
      name: 'underline',
      icon: UnderlineIcon,
      isActive: editor.isActive('underline'),
      action: (): void => {
        editor.chain().focus().toggleUnderline().run()
      }
    },
    {
      name: 'strike',
      icon: Strikethrough,
      isActive: editor.isActive('strike'),
      action: (): void => {
        editor.chain().focus().toggleStrike().run()
      }
    },
    {
      name: 'code',
      icon: Code,
      isActive: editor.isActive('code'),
      action: (): void => {
        editor.chain().focus().toggleCode().run()
      }
    },
    {
      name: 'highlight',
      icon: Highlighter,
      isActive: editor.isActive('highlight'),
      action: (): void => {
        editor.chain().focus().toggleHighlight().run()
      }
    }
  ]

  const blockButtons = [
    {
      name: 'h1',
      icon: Heading1,
      isActive: editor.isActive('heading', { level: 1 }),
      action: (): void => {
        editor.chain().focus().toggleHeading({ level: 1 }).run()
      }
    },
    {
      name: 'h2',
      icon: Heading2,
      isActive: editor.isActive('heading', { level: 2 }),
      action: (): void => {
        editor.chain().focus().toggleHeading({ level: 2 }).run()
      }
    },
    {
      name: 'h3',
      icon: Heading3,
      isActive: editor.isActive('heading', { level: 3 }),
      action: (): void => {
        editor.chain().focus().toggleHeading({ level: 3 }).run()
      }
    },
    {
      name: 'blockquote',
      icon: Quote,
      isActive: editor.isActive('blockquote'),
      action: (): void => {
        editor.chain().focus().toggleBlockquote().run()
      }
    }
  ]

  return (
    <TipTapBubbleMenu
      editor={editor}
      options={{ placement: 'top' }}
      className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-overlay/95 p-1 shadow-xl backdrop-blur-md"
    >
      <div className="flex items-center gap-0.5">
        {formatButtons.map(btn => {
          const Icon = btn.icon
          return (
            <button
              key={btn.name}
              type="button"
              onClick={btn.action}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors',
                btn.isActive
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
              )}
            >
              <Icon size={14} />
            </button>
          )
        })}
      </div>

      <Separator orientation="vertical" className="mx-1 h-4" />

      <div className="flex items-center gap-0.5">
        {blockButtons.map(btn => {
          const Icon = btn.icon
          return (
            <button
              key={btn.name}
              type="button"
              onClick={btn.action}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors',
                btn.isActive
                  ? 'bg-accent text-white'
                  : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
              )}
            >
              <Icon size={14} />
            </button>
          )
        })}
      </div>
    </TipTapBubbleMenu>
  )
}
