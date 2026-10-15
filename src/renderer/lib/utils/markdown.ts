import MarkdownIt from 'markdown-it'

const outlineParser = new MarkdownIt()

export interface DocumentHeading {
  level: number
  text: string
  line: number
  index: number
}

export function getHeadings(markdown: string): DocumentHeading[] {
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
            .join('') || inline.content,
        line: token.map[0] + 1,
        index: headings.length
      })
    }
  }
  return headings
}

export function countWords(markdown: string): number {
  const stripped = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/[*_~`>#-]/g, '')
    .trim()
  return stripped ? stripped.split(/\s+/).length : 0
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
