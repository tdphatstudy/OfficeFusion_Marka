export interface EditorFile {
  path: string | null
  name: string
  content: string
  isDirty: boolean
}

export interface EditorConfig {
  fontSize: number
  lineHeight: number
  wordWrap: boolean
  showLineNumbers: boolean
  tabSize: number
  theme: 'light' | 'dark' | 'system'
  fontFamily: 'mono' | 'sans' | 'prose'
  fullWidth: boolean
}

export interface MarkdownOptions {
  gfm: boolean
  math: boolean
  mermaid: boolean
  footnotes: boolean
  frontmatter: boolean
  sanitize: boolean
}

export type ViewMode = 'rich' | 'source' | 'split'
