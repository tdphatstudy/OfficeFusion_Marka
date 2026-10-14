export function formatDocumentToHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Untitled Document'}</title>
  <style>
    :root {
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      --font-mono: 'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace;
      --color-bg: #ffffff;
      --color-text: #1e293b;
      --color-text-muted: #64748b;
      --color-border: #e2e8f0;
      --color-accent: #4f46e5;
      --color-surface-raised: #f8fafc;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --color-bg: #0f172a;
        --color-text: #f1f5f9;
        --color-text-muted: #94a3b8;
        --color-border: #334155;
        --color-accent: #818cf8;
        --color-surface-raised: #1e293b;
      }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: var(--font-sans);
      color: var(--color-text);
      background-color: var(--color-bg);
      line-height: 1.7;
      font-size: 16px;
      padding: 3rem 2rem;
      max-width: 860px;
      margin: 0 auto;
    }
    h1, h2, h3, h4, h5, h6 {
      color: var(--color-text);
      font-weight: 700;
      line-height: 1.3;
      margin-top: 2rem;
      margin-bottom: 0.75rem;
      page-break-after: avoid;
    }
    h1 { font-size: 2.25rem; border-bottom: 2px solid var(--color-border); padding-bottom: 0.5rem; }
    h2 { font-size: 1.75rem; border-bottom: 1px solid var(--color-border); padding-bottom: 0.35rem; }
    h3 { font-size: 1.35rem; }
    h4 { font-size: 1.15rem; }
    p { margin-bottom: 1.25rem; }
    strong { font-weight: 600; }
    em { font-style: italic; }
    a { color: var(--color-accent); text-decoration: underline; text-underline-offset: 3px; }
    blockquote {
      border-left: 4px solid var(--color-accent);
      padding-left: 1.25rem;
      margin: 1.5rem 0;
      color: var(--color-text-muted);
      font-style: italic;
    }
    ul, ol {
      margin: 1rem 0 1.25rem 2rem;
    }
    li {
      margin-bottom: 0.35rem;
    }
    ul[data-type="taskList"] {
      list-style: none;
      padding-left: 0;
      margin-left: 0;
    }
    ul[data-type="taskList"] li {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
    }
    ul[data-type="taskList"] input[type="checkbox"] {
      margin-top: 0.3rem;
    }
    code {
      font-family: var(--font-mono);
      font-size: 0.875em;
      background-color: var(--color-surface-raised);
      padding: 0.2em 0.4em;
      border-radius: 4px;
      border: 1px solid var(--color-border);
    }
    pre {
      background-color: var(--color-surface-raised);
      border: 1px solid var(--color-border);
      border-radius: 8px;
      padding: 1rem;
      overflow-x: auto;
      margin: 1.5rem 0;
      page-break-inside: avoid;
    }
    pre code {
      background: none;
      padding: 0;
      border: none;
      font-size: 0.9em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.75rem 0;
      page-break-inside: avoid;
    }
    table th, table td {
      border: 1px solid var(--color-border);
      padding: 0.75rem 1rem;
      text-align: left;
    }
    table th {
      background-color: var(--color-surface-raised);
      font-weight: 600;
    }
    hr {
      border: 0;
      border-top: 1px solid var(--color-border);
      margin: 2rem 0;
    }
    [data-type="callout"] {
      border-left: 4px solid var(--color-accent);
      background-color: var(--color-surface-raised);
      border-radius: 0 8px 8px 0;
      padding: 1rem 1.25rem;
      margin: 1.5rem 0;
      page-break-inside: avoid;
    }
    [data-callout-type="warning"] { border-left-color: #f59e0b; }
    [data-callout-type="danger"] { border-left-color: #ef4444; }
    [data-callout-type="tip"] { border-left-color: #10b981; }
    @media print {
      body {
        padding: 0;
        max-width: 100%;
        background-color: #ffffff !important;
        color: #000000 !important;
      }
      h1, h2, h3, h4 {
        color: #000000 !important;
        page-break-after: avoid;
      }
      pre, table, [data-type="callout"] {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`
}

export function formatDocumentToText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`{3}[\s\S]*?`{3}/g, match => match.replace(/^```[^\n]*\n|```$/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/^>\s+/gm, '')
    .replace(/^[-*+]\s+\[[ xX]\]\s+/gm, '• ')
    .replace(/^[-*+]\s+/gm, '• ')
    .replace(/^\d+\.\s+/gm, match => match)
}
