import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { renderMarkdown } from '@/lib/preview'
import { countWords, getHeadings } from '@/lib/utils/markdown'
import { formatDocumentToHtml } from '@/lib/utils/export'
import { draftKey, readDraft } from '@/lib/draft'
import type { ElectronAPI } from '../src/renderer/types/electron'

class MemoryStorage {
  values = new Map<string, string>()
  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
  removeItem(key: string): void {
    this.values.delete(key)
  }
}

const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true })
const { useEditorStore } = await import('@/stores/editorStore')
const { useUIStore } = await import('@/stores/uiStore')
const { fileActions } = await import('@/lib/fileActions')
const { richModeLimitation } = await import('@/lib/commands')

let closed = false
const api: Pick<
  ElectronAPI,
  | 'saveFile'
  | 'openFile'
  | 'confirmUnsavedChanges'
  | 'confirmClose'
  | 'saveConnectedDocument'
  | 'openConnectedDocument'
> = {
  saveConnectedDocument: async () => 'ssh://dev/home/me/notes.md',
  openConnectedDocument: async () => ({
    content: '# Remote',
    path: 'ssh://dev/home/me/notes.md',
    location: { kind: 'ssh', host: 'dev', path: '/home/me/notes.md' },
    name: 'notes.md'
  }),
  saveFile: async () => '/notes.md',
  openFile: async () => ({ path: '/opened.md', content: '# Opened' }),
  confirmUnsavedChanges: async () => 'cancel',
  confirmClose: () => {
    closed = true
  }
}
Object.defineProperty(globalThis, 'window', { value: { api }, configurable: true })

beforeEach(() => {
  useEditorStore.getState().newFile()
  useUIStore.getState().dismissNotice()
  storage.removeItem(draftKey)
  closed = false
  api.saveFile = async () => '/notes.md'
  api.openFile = async () => ({ path: '/opened.md', content: '# Opened' })
  api.confirmUnsavedChanges = async () => 'cancel'
  api.saveConnectedDocument = async () => 'ssh://dev/home/me/notes.md'
  api.openConnectedDocument = async () => ({
    content: '# Remote',
    path: 'ssh://dev/home/me/notes.md',
    location: { kind: 'ssh', host: 'dev', path: '/home/me/notes.md' },
    name: 'notes.md'
  })
})

test('undo back to saved content clears dirty status', () => {
  const state = useEditorStore.getState()
  state.openFile('C:\\docs\\notes.md', '# Saved')
  state.setContent('# Changed')
  assert.equal(useEditorStore.getState().isDirty, true)
  state.setContent('# Saved')
  assert.equal(useEditorStore.getState().isDirty, false)
  assert.equal(useEditorStore.getState().fileName, 'notes.md')
})

test('save uses current content rather than a captured React render', async () => {
  useEditorStore.getState().setContent('Latest edit')
  api.saveFile = async content => {
    assert.equal(content, 'Latest edit')
    return '/notes.md'
  }
  await fileActions.save()
  assert.equal(useEditorStore.getState().isDirty, false)
})

test('typing while saving leaves newer edits dirty', async () => {
  useEditorStore.getState().setContent('Snapshot')
  api.saveFile = async content => {
    assert.equal(content, 'Snapshot')
    useEditorStore.getState().setContent('Snapshot plus newer edit')
    return '/notes.md'
  }
  await fileActions.save()
  assert.equal(useEditorStore.getState().savedContent, 'Snapshot')
  assert.equal(useEditorStore.getState().isDirty, true)
})

test('a late save cannot mark a different document saved', () => {
  const snapshot = useEditorStore.getState()
  snapshot.newFile('Another document')
  useEditorStore.getState().markSaved('/old.md', snapshot.content, snapshot.documentId)
  assert.equal(useEditorStore.getState().filePath, null)
  assert.equal(useEditorStore.getState().content, 'Another document')
})

test('canceling Save As preserves the original path and dirty status', async () => {
  useEditorStore.getState().openFile('/original.md', 'Original')
  useEditorStore.getState().setContent('Modified')
  api.saveFile = async (_content, path) => {
    assert.equal(path, undefined)
    return null
  }
  await fileActions.saveAs()
  assert.equal(useEditorStore.getState().filePath, '/original.md')
  assert.equal(useEditorStore.getState().isDirty, true)
})

test('canceling new document keeps unsaved changes', async () => {
  useEditorStore.getState().setContent('Keep me')
  await fileActions.newDocument()
  assert.equal(useEditorStore.getState().content, 'Keep me')
})

test('discard replaces the document with the requested template', async () => {
  useEditorStore.getState().setContent('Old')
  api.confirmUnsavedChanges = async () => 'discard'
  await fileActions.newDocument('# Meeting notes')
  assert.equal(useEditorStore.getState().content, '# Meeting notes')
  assert.equal(useEditorStore.getState().isDirty, true)
})

test('canceling save in the unsaved dialog prevents replacement', async () => {
  useEditorStore.getState().setContent('Keep me')
  api.confirmUnsavedChanges = async () => 'save'
  api.saveFile = async () => null
  await fileActions.newDocument()
  assert.equal(useEditorStore.getState().content, 'Keep me')
})

test('edits made during a save prevent closing', async () => {
  useEditorStore.getState().setContent('Before')
  api.confirmUnsavedChanges = async () => 'save'
  api.saveFile = async () => {
    useEditorStore.getState().setContent('After')
    return '/notes.md'
  }
  await fileActions.close()
  assert.equal(closed, false)
  assert.equal(useEditorStore.getState().isDirty, true)
})

test('discard on close clears dirty status so drafts are not resurrected', async () => {
  useEditorStore.getState().setContent('Discard me')
  api.confirmUnsavedChanges = async () => 'discard'
  await fileActions.close()
  assert.equal(closed, true)
  assert.equal(useEditorStore.getState().isDirty, false)
})

test('open checks for unsaved content after the native dialog resolves', async () => {
  api.openFile = async () => {
    useEditorStore.getState().setContent('Edit during file picker')
    return { path: '/opened.md', content: 'Opened' }
  }
  await fileActions.open()
  assert.equal(useEditorStore.getState().content, 'Edit during file picker')
})

test('canceling the open picker never discards the current document', async () => {
  useEditorStore.getState().setContent('Keep me')
  api.openFile = async () => null
  api.confirmUnsavedChanges = async () => 'discard'
  await fileActions.open()
  assert.equal(useEditorStore.getState().content, 'Keep me')
})

test('failed file operations preserve the document and display actionable errors', async () => {
  useEditorStore.getState().setContent('Keep me')
  api.saveFile = async () => {
    throw new Error('Permission denied')
  }
  await fileActions.save()
  assert.equal(useEditorStore.getState().isDirty, true)
  assert.match(useUIStore.getState().notice?.message ?? '', /Permission denied/)
  assert.equal(useUIStore.getState().fileBusy, false)
})

test('overlapping operations cannot replace a document during save', async () => {
  useEditorStore.getState().setContent('Keep me')
  let finish: (path: string) => void = () => {
    throw new Error('Save not started')
  }
  api.saveFile = () =>
    new Promise(resolve => {
      finish = resolve
    })
  const saving = fileActions.save()
  const replacing = fileActions.newDocument('Lost')
  finish('/notes.md')
  await Promise.all([saving, replacing])
  assert.equal(useEditorStore.getState().content, 'Keep me')
})

test('recovery accepts validated drafts, including a deliberately empty edit', () => {
  storage.setItem(
    draftKey,
    JSON.stringify({ content: '', savedContent: 'Deleted text', filePath: '/notes.md' })
  )
  assert.deepEqual(readDraft(), {
    content: '',
    savedContent: 'Deleted text',
    filePath: '/notes.md'
  })
})

test('corrupt or incompatible recovery data is ignored', () => {
  for (const raw of [
    '{broken',
    'null',
    '42',
    '{"content":42}',
    '{"content":"x","savedContent":"y","filePath":42}'
  ]) {
    storage.setItem(draftKey, raw)
    assert.equal(readDraft(), null)
  }
})

test('outline ignores fenced headings and supports setext, nested and H6 headings', () => {
  const headings = getHeadings(
    '# Intro\n\n```md\n# Not a section\n```\n\nSetext\n------\n\n> ## Nested\n\n###### End'
  )
  assert.deepEqual(
    headings.map(({ level, line, text }) => ({ level, line, text })),
    [
      { level: 1, line: 1, text: 'Intro' },
      { level: 2, line: 7, text: 'Setext' },
      { level: 2, line: 10, text: 'Nested' },
      { level: 6, line: 12, text: 'End' }
    ]
  )
})

test('word counts retain link labels and ignore code blocks', () => {
  assert.equal(
    countWords('Read [two words](https://example.com)\n\n```js\nconst hidden = true\n```'),
    3
  )
})

test('preview supports GFM, footnotes, math and source positions', () => {
  const html = renderMarkdown(
    '# Intro\n\n- [x] Done\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n$x^2$\n\nNote[^one]\n\n[^one]: Footnote'
  )
  assert.match(html, /data-source-line="1"/)
  assert.match(html, /type="checkbox"/)
  assert.match(html, /<table>/)
  assert.match(html, /class="katex"/)
  assert.match(html, /Footnote/)
})

test('preview removes scripts, event handlers, embeds and dangerous links', () => {
  const html = renderMarkdown(
    '<script>alert(1)</script>\n\n<img src="x" onerror="alert(1)">\n\n<iframe src="https://example.com"></iframe>\n\n[bad](javascript:alert%281%29)'
  )
  assert.doesNotMatch(html, /<script|onerror|<iframe|href="javascript:/i)
})

test('export math uses portable MathML without duplicated visual markup', () => {
  const html = renderMarkdown('$x^2$', 'mathml')
  assert.match(html, /<math/)
  assert.doesNotMatch(html, /katex-html/)
})

test('safe rich formatting survives preview while arbitrary CSS remains blocked', () => {
  const html = renderMarkdown(
    '<div data-type="callout" data-callout-type="warning"><p style="text-align: center;"><u>Underlined</u> <mark>Highlighted</mark></p></div>\n\n<p style="background-image: url(https://example.com/track)">Blocked CSS</p>'
  )
  assert.match(html, /data-type="callout"/)
  assert.match(html, /data-callout-type="warning"/)
  assert.match(html, /style="text-align: center;"/)
  assert.match(html, /<u>Underlined<\/u>/)
  assert.match(html, /<mark>Highlighted<\/mark>/)
  assert.doesNotMatch(html, /background-image|example.com\/track/)
})

test('export escapes filenames and blocks active content with CSP', () => {
  const html = formatDocumentToHtml('</title><script>bad</script>', '<p>Hello</p>')
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /Content-Security-Policy/)
  assert.match(html, /&lt;\/title&gt;/)
})

test('advanced Markdown and large documents are kept out of lossy rich editing', () => {
  for (const content of [
    '---\ntitle: Notes\n---',
    '$x^2$',
    'Note[^one]',
    '```mermaid\ngraph TD',
    'x'.repeat(100_001)
  ]) {
    assert.ok(richModeLimitation(content))
  }
  assert.equal(richModeLimitation('# Ordinary\n\nA paragraph.'), null)
})

test('preview handles a 50 KB document within the regression budget', () => {
  const content =
    '# Section\n\nA paragraph with **bold** and [a link](https://example.com).\n\n'.repeat(720)
  const start = performance.now()
  const html = renderMarkdown(content)
  const elapsed = performance.now() - start
  assert.match(html, /<strong>bold<\/strong>/)
  assert.ok(elapsed < 2500, `Preview took ${elapsed.toFixed(0)}ms`)
})

test('SSH Save writes back to the original endpoint with the saved snapshot', async () => {
  const target = { kind: 'ssh' as const, host: 'dev', path: '/home/me/notes.md' }
  useEditorStore.getState().openFile('ssh://dev/home/me/notes.md', 'Original', target)
  useEditorStore.getState().setContent('Changed')
  api.saveConnectedDocument = async (location, content, expected) => {
    assert.deepEqual(location, target)
    assert.equal(content, 'Changed')
    assert.equal(expected, 'Original')
    return 'ssh://dev/home/me/notes.md'
  }
  await fileActions.save()
  assert.equal(useEditorStore.getState().isDirty, false)
  assert.equal(useEditorStore.getState().fileLocation?.kind, 'ssh')
})

test('SSH Save As creates a local copy and switches subsequent saves to local', async () => {
  const target = { kind: 'ssh' as const, host: 'dev', path: '/home/me/notes.md' }
  useEditorStore.getState().openFile('ssh://dev/home/me/notes.md', 'Original', target)
  await fileActions.saveAs()
  assert.deepEqual(useEditorStore.getState().fileLocation, { kind: 'local', path: '/notes.md' })
})

test('SSH reconnect preserves dirty edits and their original saved snapshot', async () => {
  const target = { kind: 'ssh' as const, host: 'dev', path: '/home/me/notes.md' }
  const path = 'ssh://dev/home/me/notes.md'
  useEditorStore.getState().openFile(path, 'Original', target)
  useEditorStore.getState().setContent('Keep my draft')
  api.openConnectedDocument = async () => ({
    content: 'External changes',
    path,
    location: target,
    name: 'notes.md'
  })
  assert.equal(
    await fileActions.reconnectTarget(target, { method: 'password', password: 'mock-password' }),
    true
  )
  assert.equal(useEditorStore.getState().content, 'Keep my draft')
  assert.equal(useEditorStore.getState().savedContent, 'Original')
  assert.equal(useEditorStore.getState().isDirty, true)
})

test('reconnect rejects a different destination without replacing the active draft', async () => {
  useEditorStore.getState().setContent('Keep my draft')
  api.openConnectedDocument = async () => ({
    content: 'Other',
    path: 'ssh://other/notes.md',
    location: { kind: 'ssh', host: 'other', path: '/notes.md' },
    name: 'notes.md'
  })
  assert.equal(
    await fileActions.reconnectTarget({ kind: 'ssh', host: 'other', path: '/notes.md' }),
    false
  )
  assert.equal(useEditorStore.getState().content, 'Keep my draft')
})

test('failed SSH writes keep edits and their original endpoint', async () => {
  const target = { kind: 'ssh' as const, host: 'dev', path: '/home/me/notes.md' }
  useEditorStore.getState().openFile('ssh://dev/home/me/notes.md', 'Original', target)
  useEditorStore.getState().setContent('Changed')
  api.saveConnectedDocument = async () => {
    throw new Error('File changed on the server')
  }
  await fileActions.save()
  assert.equal(useEditorStore.getState().isDirty, true)
  assert.equal(useEditorStore.getState().fileLocation?.kind, 'ssh')
  assert.match(useUIStore.getState().notice?.message ?? '', /changed on the server/)
})

test('opening an SSH document respects the unsaved guard', async () => {
  useEditorStore.getState().setContent('Keep this local draft')
  assert.equal(
    await fileActions.openTarget({ kind: 'ssh', host: 'dev', path: '/home/me/notes.md' }),
    false
  )
  assert.equal(useEditorStore.getState().content, 'Keep this local draft')
  api.confirmUnsavedChanges = async () => 'discard'
  assert.equal(
    await fileActions.openTarget({ kind: 'ssh', host: 'dev', path: '/home/me/notes.md' }),
    true
  )
  assert.equal(useEditorStore.getState().fileLocation?.kind, 'ssh')
})

test('URL imports become dirty local drafts rather than remote save targets', async () => {
  api.openConnectedDocument = async () => ({
    content: '# Imported',
    location: null,
    path: null,
    name: 'notes.md'
  })
  await fileActions.openTarget({ kind: 'url', url: 'https://example.com/notes.md' })
  assert.equal(useEditorStore.getState().fileLocation, null)
  assert.equal(useEditorStore.getState().fileName, 'notes.md')
  assert.equal(useEditorStore.getState().isDirty, true)
})

test('recovery preserves remote destinations and refuses untyped SSH paths', () => {
  const target = { kind: 'ssh', host: 'dev', path: '/home/me/notes.md' }
  storage.setItem(
    draftKey,
    JSON.stringify({
      content: 'Changed',
      savedContent: 'Original',
      filePath: 'ssh://dev/home/me/notes.md',
      location: target
    })
  )
  assert.deepEqual(readDraft()?.location, target)
  storage.setItem(
    draftKey,
    JSON.stringify({
      content: 'Changed',
      savedContent: 'Original',
      filePath: 'ssh://dev/home/me/notes.md'
    })
  )
  assert.equal(readDraft(), null)
})

test('recent documents deduplicate and query-bearing URL credentials are not persisted', async () => {
  const { useConnectionStore } = await import('@/stores/connectionStore')
  useConnectionStore.getState().clearRecent()
  useConnectionStore.getState().remember({ kind: 'local', path: '/notes.md' })
  useConnectionStore.getState().remember({ kind: 'local', path: '/notes.md' })
  useConnectionStore
    .getState()
    .remember({ kind: 'url', url: 'https://example.com/file?token=secret' })
  assert.equal(useConnectionStore.getState().recent.length, 1)
  assert.throws(() =>
    useConnectionStore
      .getState()
      .saveProfile('Private URL', { kind: 'url', url: 'https://example.com/file?token=secret' })
  )
})
