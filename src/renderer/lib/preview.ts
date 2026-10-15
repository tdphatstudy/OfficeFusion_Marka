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
    '*': [
      ...(defaultSchema.attributes?.['*'] ?? []),
      ['style', /^text-align:\s*(left|center|right|justify);?$/i]
    ]
  }
}

function headingPositions(): (tree: HtmlNode) => void {
  return tree => {
    const visit = (node: HtmlNode): void => {
      if (node.tagName && /^h[1-6]$/.test(node.tagName) && node.position) {
        node.properties = { ...node.properties, 'data-source-line': node.position.start.line }
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
    .use(headingPositions)
    .use(rehypeKatex, { throwOnError: false, trust: false, output })
    .use(rehypeHighlight, { detect: false, ignoreMissing: true })
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
  return String(processors[mathOutput].processSync(content))
}
