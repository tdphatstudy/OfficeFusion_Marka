import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkFrontmatter from 'remark-frontmatter'
import remarkRehype from 'remark-rehype'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema, type Options as SanitizeOptions } from 'rehype-sanitize'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import rehypeStringify from 'rehype-stringify'
import { exportCharacters, previewCharacters } from './documents'

interface HtmlNode {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  position?: { start: { line: number } }
  children?: HtmlNode[]
}

const previewSchema: SanitizeOptions = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'mark', 'u'],
  attributes: {
    ...defaultSchema.attributes,
    div: [
      ...(defaultSchema.attributes?.['div'] ?? []),
      ['dataType', 'callout'],
      ['dataCalloutType', 'info', 'warning', 'tip', 'danger']
    ],
    tr: [['style', /^height:\s*(?:[2-9]\d|[1-5]\d\d|600)px;?$/i]],
    td: [['colwidth', /^(?:[2-9]\d|[1-9]\d{2,3})(?:,(?:[2-9]\d|[1-9]\d{2,3}))*$/]],
    th: [['colwidth', /^(?:[2-9]\d|[1-9]\d{2,3})(?:,(?:[2-9]\d|[1-9]\d{2,3}))*$/]],
    '*': [
      ...(defaultSchema.attributes?.['*'] ?? []),
      ['style', /^text-align:\s*(left|center|right|justify);?$/i]
    ]
  }
}

function headingPositions(): (tree: HtmlNode) => void {
  return tree => {
    let nodes = 0
    const visit = (node: HtmlNode, depth = 0): void => {
      if (++nodes > 20_000 || depth > 100) {
        throw new Error('Document is too complex to preview. Use Markdown mode.')
      }
      if (node.tagName === 'td' || node.tagName === 'th') {
        const width = node.properties?.colwidth
        if (typeof width === 'string' && /^\d{2,4}(?:,\d{2,4})*$/.test(width)) {
          const total = width.split(',').reduce((sum, item) => sum + Number(item), 0)
          if (total >= 25 && total <= 20_000) {
            node.properties = { ...node.properties, style: `width: ${total}px` }
          }
        }
      }
      if (
        node.tagName &&
        /^(?:h[1-6]|p|pre|blockquote|li|table)$/.test(node.tagName) &&
        node.position
      ) {
        node.properties = { ...node.properties, 'data-source-line': node.position.start.line }
      }
      node.children?.forEach(child => visit(child, depth + 1))
    }
    visit(tree)
  }
}

function renderedTreeBudget(): (tree: HtmlNode) => void {
  return headingPositions()
}

function previewImageSources(options: { enabled: boolean }): (tree: HtmlNode) => void {
  return tree => {
    if (!options.enabled) {
      return
    }
    const visit = (node: HtmlNode): void => {
      if (node.tagName === 'img' && typeof node.properties?.src === 'string') {
        node.properties['data-markdown-src'] = node.properties.src
        delete node.properties.src
      }
      node.children?.forEach(visit)
    }
    visit(tree)
  }
}

function createProcessor(output: 'htmlAndMathml' | 'mathml') {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeSanitize, previewSchema)
    .use(previewImageSources, { enabled: output === 'htmlAndMathml' })
    .use(headingPositions)
    .use(rehypeKatex, { throwOnError: false, trust: false, maxSize: 20, maxExpand: 500, output })
    .use(rehypeHighlight, { detect: false, ignoreMissing: true })
    .use(renderedTreeBudget)
    .use(rehypeStringify)
}

const processors = {
  htmlAndMathml: createProcessor('htmlAndMathml'),
  mathml: createProcessor('mathml')
}

export function renderMarkdown(
  content: string,
  mathOutput: 'htmlAndMathml' | 'mathml' = 'htmlAndMathml'
): string {
  const maximum = mathOutput === 'mathml' ? exportCharacters : previewCharacters
  if (content.length > maximum || content.split('\n').some(line => line.length > 16_384)) {
    throw new Error(
      'Document exceeds the rendering budget. Use Markdown mode or export a smaller section.'
    )
  }
  const output = String(processors[mathOutput].processSync(content))
  if (output.length > 2 * 1024 * 1024) {
    throw new Error('Rendered document exceeds the output budget.')
  }
  return output
}
