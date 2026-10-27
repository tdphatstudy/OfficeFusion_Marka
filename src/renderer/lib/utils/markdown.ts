import MarkdownIt from 'markdown-it'

const outlineParser = new MarkdownIt({ html: true })

export interface DocumentHeading {
  level: number
  text: string
  line: number
  index: number
}

export function getHeadings(markdown: string): DocumentHeading[] {
  if (markdown.length > 128 * 1024) {
    return []
  }
  const tokens = outlineParser.parse(markdown, {})
  const headings: DocumentHeading[] = []
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]
    const inline = tokens[index + 1]
    if (token?.type === 'heading_open' && token.map && inline) {
      headings.push({
        level: Number(token.tag.slice(1)),
        text:
          inline.children
            ?.filter(child => ['text', 'code_inline', 'image'].includes(child.type))
            .map(child => child.content)
            .join('') ?? inline.content,
        line: token.map[0] + 1,
        index: headings.length
      })
      if (headings.length >= 500) {
        break
      }
    }
  }
  return headings
}

export function countWords(markdown: string): number {
  let words = 0
  let inWord = false
  let lineStart = true
  let fence = ''
  let inline = false
  let image = false
  let destination = 0
  let tag = false
  for (let index = 0; index < markdown.length; index++) {
    const character = markdown[index] ?? ''
    if (
      lineStart &&
      (character === '`' || character === '~') &&
      markdown[index + 1] === character &&
      markdown[index + 2] === character
    ) {
      fence = fence ? '' : character
      while (index < markdown.length && markdown[index] !== '\n') {
        index++
      }
      lineStart = true
      inWord = false
      continue
    }
    lineStart = character === '\n'
    if (fence) {
      continue
    }
    if (character === '`') {
      inline = !inline
      inWord = false
      continue
    }
    if (inline) {
      continue
    }
    if (destination) {
      if (character === '(') {
        destination++
      }
      if (character === ')') {
        destination--
      }
      continue
    }
    if (character === ']' && markdown[index + 1] === '(') {
      destination = 1
      image = false
      index++
      continue
    }
    if (character === '!' && markdown[index + 1] === '[') {
      image = true
      index++
      continue
    }
    if (image) {
      if (character === ']' || character === '\n') {
        image = false
      }
      continue
    }
    if (character === '<') {
      tag = true
      continue
    }
    if (tag) {
      if (character === '>') {
        tag = false
      }
      continue
    }
    if ('*_~>#-[]'.includes(character)) {
      continue
    }
    if (/\s/.test(character)) {
      inWord = false
    } else if (!inWord) {
      words++
      inWord = true
    }
  }
  return words
}

export function countChars(markdown: string): number {
  return markdown.replace(/\s/g, '').length
}

export function estimateReadingTime(markdown: string): number {
  return Math.max(1, Math.ceil(countWords(markdown) / 200))
}

export function extractFrontmatter(markdown: string): { frontmatter: string; body: string } {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/m)
  if (!match) {
    return { frontmatter: '', body: markdown }
  }
  return { frontmatter: match[1] ?? '', body: match[2] ?? '' }
}

export function extractTitle(markdown: string): string | null {
  const match = markdown.match(/^#{1,2}\s+(.+)$/m)
  return match?.[1] ? match[1].trim() : null
}
