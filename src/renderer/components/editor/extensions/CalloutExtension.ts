import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { CalloutBlock } from '../nodes/CalloutBlock'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attributes?: { type?: string }) => ReturnType
    }
  }
}

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: element => element.getAttribute('data-callout-type') || 'info',
        renderHTML: attributes => ({
          'data-callout-type': attributes['type']
        })
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]'
      }
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutBlock)
  },

  addCommands() {
    return {
      setCallout:
        (attributes = {}) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attributes)
        }
    }
  }
})
