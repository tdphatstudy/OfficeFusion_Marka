import type { Editor } from '@tiptap/core'
import {
  type LucideIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  CheckSquare,
  Code2,
  Quote,
  Minus,
  Table as TableIcon,
  AlertCircle,
  Type
} from 'lucide-react'

export interface CommandItem {
  title: string
  description: string
  icon: LucideIcon
  command: (editor: Editor) => void
  keywords: string[]
}

export const slashCommands: CommandItem[] = [
  {
    title: 'Text',
    description: 'Plain text paragraph block',
    icon: Type,
    keywords: ['paragraph', 'normal', 'text', 'p'],
    command: (editor: Editor): void => {
      editor.chain().focus().setParagraph().run()
    }
  },
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: Heading1,
    keywords: ['h1', 'title', 'heading1', 'large'],
    command: (editor: Editor): void => {
      editor.chain().focus().toggleHeading({ level: 1 }).run()
    }
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: Heading2,
    keywords: ['h2', 'subtitle', 'heading2', 'medium'],
    command: (editor: Editor): void => {
      editor.chain().focus().toggleHeading({ level: 2 }).run()
    }
  },
  {
    title: 'Heading 3',
    description: 'Small subsection heading',
    icon: Heading3,
    keywords: ['h3', 'subheading', 'heading3', 'small'],
    command: (editor: Editor): void => {
      editor.chain().focus().toggleHeading({ level: 3 }).run()
    }
  },
  {
    title: 'Bullet List',
    description: 'Standard bulleted list',
    icon: List,
    keywords: ['bullet', 'unordered', 'list', 'ul'],
    command: (editor: Editor): void => {
      editor.chain().focus().toggleBulletList().run()
    }
  },
  {
    title: 'Numbered List',
    description: 'Sequential ordered list',
    icon: ListOrdered,
    keywords: ['numbered', 'ordered', 'list', 'ol', '1.'],
    command: (editor: Editor): void => {
      editor.chain().focus().toggleOrderedList().run()
    }
  },
  {
    title: 'Task List',
    description: 'Interactive checklist with task items',
    icon: CheckSquare,
    keywords: ['task', 'todo', 'check', 'checklist'],
    command: (editor: Editor): void => {
      editor.chain().focus().toggleTaskList().run()
    }
  },
  {
    title: 'Callout',
    description: 'Highlight important information in a box',
    icon: AlertCircle,
    keywords: ['callout', 'admonition', 'note', 'alert', 'warning', 'tip'],
    command: (editor: Editor): void => {
      editor.chain().focus().setCallout().run()
    }
  },
  {
    title: 'Table',
    description: 'Insert a 3x3 interactive table',
    icon: TableIcon,
    keywords: ['table', 'grid', 'columns', 'rows'],
    command: (editor: Editor): void => {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
    }
  },
  {
    title: 'Code Block',
    description: 'Code snippet with syntax support',
    icon: Code2,
    keywords: ['code', 'pre', 'snippet', 'codeblock'],
    command: (editor: Editor): void => {
      editor.chain().focus().toggleCodeBlock().run()
    }
  },
  {
    title: 'Blockquote',
    description: 'Quote reference or block citation',
    icon: Quote,
    keywords: ['quote', 'blockquote', 'citation'],
    command: (editor: Editor): void => {
      editor.chain().focus().toggleBlockquote().run()
    }
  },
  {
    title: 'Divider',
    description: 'Horizontal divider line',
    icon: Minus,
    keywords: ['divider', 'hr', 'horizontal', 'line', 'separator'],
    command: (editor: Editor): void => {
      editor.chain().focus().setHorizontalRule().run()
    }
  }
]
