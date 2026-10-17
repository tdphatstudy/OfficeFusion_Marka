import type { MarkdownStorage } from 'tiptap-markdown'
import type { Node } from '@tiptap/pm/model'

declare module 'tiptap-markdown' {
  interface MarkdownStorage {
    serializer: { serialize: (document: Node) => string }
  }
}

declare module '@tiptap/core' {
  interface Storage {
    markdown: MarkdownStorage
  }
}
