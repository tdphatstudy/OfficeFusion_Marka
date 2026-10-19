import type { Node } from '@tiptap/pm/model'

export interface TextMatch {
  from: number
  to: number
}

export function findRichText(doc: Node, query: string, matchCase: boolean): TextMatch[] {
  if (!query || query.length > 1000) {
    return []
  }
  const expression = new RegExp(
    query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    matchCase ? 'gu' : 'giu'
  )
  const matches: TextMatch[] = []
  doc.descendants((node, position) => {
    if (matches.length >= 500) {
      return false
    }
    if (!node.isTextblock) {
      return true
    }
    const text = node.textBetween(0, node.content.size, '', '\uFFFC')
    for (const match of text.matchAll(expression)) {
      matches.push({
        from: position + 1 + match.index,
        to: position + 1 + match.index + match[0].length
      })
      if (matches.length >= 500) {
        break
      }
    }
    return false
  })
  return matches
}
