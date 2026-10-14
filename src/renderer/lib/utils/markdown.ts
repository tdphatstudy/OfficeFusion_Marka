export function countWords(markdown: string): number {
  const stripped = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[.*?\]\(.*?\)/g, '$1')
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
