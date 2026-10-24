import { getHTMLFromFragment } from '@tiptap/core'
import { Table, TableRow } from '@tiptap/extension-table'
import { Fragment } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'

const rowHeight = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) && parsed >= 28 && parsed <= 600 ? parsed : null
}

export const ResizableRow = TableRow.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      rowHeight: {
        default: null,
        parseHTML: element => rowHeight((element as HTMLElement).style.height),
        renderHTML: attributes => {
          const height = rowHeight(attributes.rowHeight)
          return height ? { style: `height: ${height}px` } : {}
        }
      }
    }
  }
})

export const ResizableTable = Table.extend({
  addStorage() {
    return {
      ...this.parent?.(),
      markdown: {
        serialize(
          state: {
            write: (text: string) => void
            ensureNewLine: () => void
            closeBlock: (node: unknown) => void
            renderInline: (node: unknown) => void
            inTable: boolean
          },
          node: typeof this.editor.state.doc
        ) {
          let htmlRequired = false
          node.forEach((row, _offset, index) => {
            if (row.attrs.rowHeight) {
              htmlRequired = true
            }
            row.forEach(cell => {
              if (
                cell.attrs.colwidth ||
                cell.attrs.colspan > 1 ||
                cell.attrs.rowspan > 1 ||
                cell.childCount > 1 ||
                cell.type.name !== (index ? 'tableCell' : 'tableHeader')
              ) {
                htmlRequired = true
              }
            })
          })
          if (htmlRequired) {
            state.write(getHTMLFromFragment(Fragment.from(node), node.type.schema))
            state.closeBlock(node)
            return
          }
          state.inTable = true
          node.forEach((row, _offset, index) => {
            state.write('| ')
            row.forEach((cell, _cellOffset, column) => {
              if (column) {
                state.write(' | ')
              }
              const content = cell.firstChild
              if (content?.textContent.trim()) {
                state.renderInline(content)
              }
            })
            state.write(' |')
            state.ensureNewLine()
            if (!index) {
              state.write(`| ${Array.from({ length: row.childCount }, () => '---').join(' | ')} |`)
              state.ensureNewLine()
            }
          })
          state.closeBlock(node)
          state.inTable = false
        }
      }
    }
  }
})

export function beginRowResize(view: EditorView, event: MouseEvent): void {
  if (!(event.target instanceof HTMLElement)) {
    return
  }
  const cell = event.target.closest('td, th')
  const row = cell?.closest('tr')
  if (!row || !cell || !view.dom.contains(row)) {
    return
  }
  const rect = cell.getBoundingClientRect()
  if (rect.bottom - event.clientY > 7 || rect.bottom - event.clientY < 0) {
    return
  }
  const start = row.getBoundingClientRect().height
  const startY = event.clientY
  const resolved = view.state.doc.resolve(view.posAtDOM(cell, 0))
  let rowPosition = -1
  for (let depth = resolved.depth; depth > 0; depth--) {
    if (resolved.node(depth).type.name === 'tableRow') {
      rowPosition = resolved.before(depth)
      break
    }
  }
  if (rowPosition < 0) {
    return
  }
  event.preventDefault()
  const heightAt = (pointer: MouseEvent): number =>
    Math.max(28, Math.min(600, Math.round(start + pointer.clientY - startY)))
  const move = (pointer: MouseEvent): void => {
    row.style.height = `${heightAt(pointer)}px`
  }
  const stop = (pointer: MouseEvent): void => {
    document.removeEventListener('mousemove', move)
    const node = view.state.doc.nodeAt(rowPosition)
    if (node?.type.name === 'tableRow') {
      view.dispatch(
        view.state.tr.setNodeMarkup(rowPosition, undefined, {
          ...node.attrs,
          rowHeight: heightAt(pointer)
        })
      )
    }
  }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', stop, { once: true })
}
