import type { Editor } from '@tiptap/core'
import {
  type LucideIcon,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  CheckSquare,
  Code2,
  Quote,
  Minus,
  Table as TableIcon,
  AlertCircle,
  AlertTriangle,
  Lightbulb,
  Flame,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Image as ImageIcon,
  Eraser
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
    title: 'Heading 4',
    description: 'Sub-subsection heading',
    icon: Heading4,
    keywords: ['h4', 'heading4', 'minor', 'sub'],
    command: (editor: Editor): void => {
      editor.chain().focus().toggleHeading({ level: 4 }).run()
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
    title: 'Table',
    description: 'Choose rows and columns for a table',
    icon: TableIcon,
    keywords: ['table', 'grid', 'columns', 'rows'],
    command: (editor: Editor): void => {
      editor.chain().focus().run()
      window.dispatchEvent(new Event('marka:open-table-picker'))
    }
  },
  {
    title: 'Callout (Info)',
    description: 'Blue informational callout box',
    icon: AlertCircle,
    keywords: ['callout', 'info', 'note', 'admonition'],
    command: (editor: Editor): void => {
      editor.chain().focus().setCallout({ type: 'info' }).run()
    }
  },
  {
    title: 'Callout (Tip)',
    description: 'Green helpful tip callout box',
    icon: Lightbulb,
    keywords: ['tip', 'success', 'hint', 'callout'],
    command: (editor: Editor): void => {
      editor.chain().focus().setCallout({ type: 'tip' }).run()
    }
  },
  {
    title: 'Callout (Warning)',
    description: 'Amber warning attention box',
    icon: AlertTriangle,
    keywords: ['warning', 'caution', 'alert', 'callout'],
    command: (editor: Editor): void => {
      editor.chain().focus().setCallout({ type: 'warning' }).run()
    }
  },
  {
    title: 'Callout (Danger)',
    description: 'Red critical danger box',
    icon: Flame,
    keywords: ['danger', 'error', 'critical', 'callout'],
    command: (editor: Editor): void => {
      editor.chain().focus().setCallout({ type: 'danger' }).run()
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
  },
  {
    title: 'Image',
    description: 'Search public images and GIFs or choose a local file',
    icon: ImageIcon,
    keywords: ['image', 'photo', 'picture', 'img'],
    command: (editor: Editor): void => {
      editor.chain().focus().run()
      window.dispatchEvent(new Event('marka:open-image-picker'))
    }
  },
  {
    title: 'Align Left',
    description: 'Align text to the left',
    icon: AlignLeft,
    keywords: ['align', 'left', 'text'],
    command: (editor: Editor): void => {
      editor.chain().focus().setTextAlign('left').run()
    }
  },
  {
    title: 'Align Center',
    description: 'Center align current block',
    icon: AlignCenter,
    keywords: ['align', 'center', 'middle'],
    command: (editor: Editor): void => {
      editor.chain().focus().setTextAlign('center').run()
    }
  },
  {
    title: 'Align Right',
    description: 'Align text to the right',
    icon: AlignRight,
    keywords: ['align', 'right'],
    command: (editor: Editor): void => {
      editor.chain().focus().setTextAlign('right').run()
    }
  },
  {
    title: 'Justify Text',
    description: 'Justify text alignment',
    icon: AlignJustify,
    keywords: ['justify', 'align', 'full'],
    command: (editor: Editor): void => {
      editor.chain().focus().setTextAlign('justify').run()
    }
  },
  {
    title: 'Clear Formatting',
    description: 'Clear all inline marks and styles',
    icon: Eraser,
    keywords: ['clear', 'remove', 'format', 'reset'],
    command: (editor: Editor): void => {
      editor.chain().focus().unsetAllMarks().clearNodes().run()
    }
  }
]
