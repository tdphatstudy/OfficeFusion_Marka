import Image from '@tiptap/extension-image'
import { mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { LocalImageView } from '../LocalImageView'
import { imageWidth } from '@/lib/imageDimensions'

const htmlAttribute = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    character =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ??
      character
  )

export const ManagedImage = Image.extend({
  renderHTML({ HTMLAttributes }) {
    const { src, ...safeAttributes } = HTMLAttributes
    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, safeAttributes, { 'data-markdown-src': src })
    ]
  },
  addStorage() {
    return {
      ...this.parent?.(),
      markdown: {
        serialize(
          state: { write: (text: string) => void; esc: (text: string) => string },
          node: { attrs: Record<string, unknown> }
        ) {
          const src = String(node.attrs.src ?? '')
          const alt = String(node.attrs.alt ?? '')
          const title = String(node.attrs.title ?? '')
          const width = imageWidth(node.attrs.width)
          if (width) {
            state.write(
              `<img src="${htmlAttribute(src)}" alt="${htmlAttribute(alt)}" width="${width}">`
            )
          } else {
            state.write(
              `![${state.esc(alt)}](${src.replace(/[()]/g, '\\$&')}${title ? ` "${title.replace(/"/g, '\\"')}"` : ''})`
            )
          }
        }
      }
    }
  },
  addNodeView: () => ReactNodeViewRenderer(LocalImageView)
})
