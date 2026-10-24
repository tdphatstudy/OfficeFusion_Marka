import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Schema } from '@tiptap/pm/model'
import { FileBrowser, checkedBrowserQuery, withinRoot } from '../src/main/browser'
import { FileAccess, readTextRange } from '../src/main/files'
import { findRichText } from '../src/renderer/lib/richSearch'
import { searchRanges } from '../src/renderer/lib/rangeSearch'
import { commonsImages, documentImages, imageUrl, openverseImages, resizeImageMarkup } from '../src/renderer/lib/remoteImages'

test('public image results keep only safe direct image URLs and source pages', () => {
  const valid = {
    title: 'File:Example.gif',
    imageinfo: [
      {
        mime: 'image/gif',
        url: 'https://upload.wikimedia.org/a.gif',
        thumburl: 'https://upload.wikimedia.org/preview.gif',
        descriptionurl: 'https://commons.wikimedia.org/wiki/File:Example.gif'
      }
    ]
  }
  const invalid = {
    ...valid,
    title: 'File:Bad.gif',
    imageinfo: [{ ...valid.imageinfo[0], url: 'http://127.0.0.1/private.gif' }]
  }
  assert.deepEqual(
    commonsImages({ query: { pages: [valid, invalid] } }).map(item => item.title),
    ['Example.gif']
  )
  assert.equal(imageUrl('javascript:alert(1)'), null)
  assert.equal(imageUrl('file:///secret.png'), null)
  assert.equal(imageUrl('https://user:pass@example.com/image.png'), null)
  assert.equal(imageUrl(' https://example.com/image.png '), 'https://example.com/image.png')
})

test('Openverse results filter unsupported formats and unsafe URLs', () => {
  const result = { title: 'Trend', url: 'https://example.com/trend.webp', thumbnail: 'https://example.com/thumb.webp', foreign_landing_url: 'https://example.com/license', filetype: 'webp', creator: 'Artist', license: 'cc-by' }
  assert.deepEqual(openverseImages({ results: [result, { ...result, url: 'http://localhost/private.webp' }, { ...result, filetype: 'svg' }] }).map(item => item.title), ['Trend'])
})

test('image manager finds images outside code and safely resizes markup', () => {
  const markdown = '![Cat](https://example.com/cat.png)\n\n```md\n![Ignored](bad)\n```\n\n<img src="https://example.com/dog.jpg" width="220" alt="Dog">'
  const images = documentImages(markdown)
  assert.equal(images.length, 2)
  assert.equal(images[1].width, 220)
  assert.match(resizeImageMarkup(markdown.slice(images[0].from, images[0].to), images[0], 320) ?? '', /width="320"/)
  assert.equal(resizeImageMarkup('', images[0], 9000), null)
})

const query = { path: '', filter: '', hidden: false, markdownOnly: true, offset: 0 }

test('folder queries reject malformed paths, unbounded offsets and coercion', () => {
  for (const input of [
    null,
    {},
    { ...query, offset: -1 },
    { ...query, offset: 0.5 },
    { ...query, offset: 10001 },
    { ...query, filter: 'x'.repeat(201) },
    { ...query, path: '/tmp/\0bad' },
    { ...query, hidden: 'false' }
  ])
    assert.throws(() => checkedBrowserQuery(input))
  assert.deepEqual(checkedBrowserQuery({ ...query, path: '/tmp/notes' }), {
    ...query,
    path: '/tmp/notes'
  })
})

test('folder scope rejects parent and sibling-prefix traversal', () => {
  const root = join(tmpdir(), 'approved')
  assert.equal(withinRoot(root, join(root, 'child')), true)
  assert.equal(withinRoot(root, root), true)
  assert.equal(withinRoot(root, join(root, '..', 'approved-other')), false)
  assert.equal(withinRoot(root, join(root, '..')), false)
})

test('browser filters Markdown, preserves folders, pages matches and blocks escaped symlinks', async () => {
  const root = await mkdtemp(join(tmpdir(), 'marka-browser-'))
  const outside = await mkdtemp(join(tmpdir(), 'marka-outside-'))
  try {
    await mkdir(join(root, 'Projects'))
    await Promise.all(
      [
        'notes.md',
        'README.MARKDOWN',
        'ghi chú.mdown',
        '.hidden.md',
        'other.txt',
        '<script>.md'
      ].map(name => writeFile(join(root, name.replace(/[<>]/g, '_')), '# Fixture'))
    )
    const browser = await FileBrowser.local(root)
    const signal = new AbortController().signal
    const first = await browser.list({ ...query, path: root }, signal)
    assert.equal(first.parent, null)
    assert.equal(first.entries[0]?.name, 'Projects')
    assert.equal(
      first.entries.some(entry => entry.name === 'other.txt' || entry.name === '.hidden.md'),
      false
    )
    assert.equal(
      first.entries.some(entry => entry.name === 'ghi chú.mdown'),
      true
    )
    const filtered = await browser.list({ ...query, path: root, filter: 'NOTES' }, signal)
    assert.deepEqual(
      filtered.entries.map(entry => entry.name),
      ['notes.md']
    )
    const all = await browser.list(
      { ...query, path: root, hidden: true, markdownOnly: false },
      signal
    )
    assert.equal(
      all.entries.some(entry => entry.name === '.hidden.md'),
      true
    )
    assert.equal(
      all.entries.some(entry => entry.name === 'other.txt'),
      true
    )
    const nested = await browser.list({ ...query, path: join(root, 'Projects') }, signal)
    assert.equal(nested.parent, root)
    await assert.rejects(() => browser.checkedPath(outside), /approved/)
    await symlink(outside, join(root, 'escape'), process.platform === 'win32' ? 'junction' : 'dir')
    await assert.rejects(() => browser.checkedPath(join(root, 'escape')), /approved/)
    await Promise.all(
      Array.from({ length: 210 }, (_, index) =>
        writeFile(join(root, `page-${String(index).padStart(3, '0')}.md`), 'fixture')
      )
    )
    const page1 = await browser.list({ ...query, path: root, filter: 'page-' }, signal)
    const page2 = await browser.list({ ...query, path: root, filter: 'page-', offset: 200 }, signal)
    assert.equal(page1.entries.length, 200)
    assert.equal(page1.truncated, true)
    assert.equal(page2.entries.length, 10)
    assert.equal(page2.truncated, false)
    assert.equal(new Set([...page1.entries, ...page2.entries].map(entry => entry.path)).size, 210)
    const aborted = new AbortController()
    aborted.abort()
    await assert.rejects(() => browser.list({ ...query, path: root }, aborted.signal))
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
  }
})

test('comparison does not authorize saving over an external revision', async () => {
  const root = await mkdtemp(join(tmpdir(), 'marka-compare-'))
  const file = join(root, 'notes.md')
  const access = new FileAccess()
  try {
    await writeFile(file, 'baseline')
    await access.open(file)
    await writeFile(file, 'external edit')
    assert.equal((await access.inspect(file)).content, 'external edit')
    await assert.rejects(() => access.save(file, 'my draft', 'baseline'), /changed/)
    await assert.rejects(() => access.inspect(join(root, 'unopened.md')), /expired/)
    await access.dispose()
    await assert.rejects(() => access.inspect(file), /expired/)
  } finally {
    await access.dispose()
    await rm(root, { recursive: true, force: true })
  }
})

test('large directory listings stay capped at 200 entries with a 10,000-entry scan budget', async () => {
  const root = await mkdtemp(join(tmpdir(), 'marka-directory-budget-'))
  try {
    for (let start = 0; start < 10001; start += 100) {
      await Promise.all(
        Array.from({ length: Math.min(100, 10001 - start) }, (_, offset) =>
          writeFile(join(root, `${start + offset}.md`), '')
        )
      )
    }
    const browser = await FileBrowser.local(root)
    const page = await browser.list({ ...query, path: root }, new AbortController().signal)
    assert.equal(page.entries.length, 200)
    assert.equal(page.truncated, true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

const schema = new Schema({
  nodes: {
    doc: { content: 'paragraph+' },
    paragraph: { content: 'inline*', group: 'block' },
    text: { group: 'inline' },
    hard_break: { inline: true, group: 'inline' }
  },
  marks: { strong: {} }
})

test('Write search preserves positions across marks, Unicode and inline atoms', () => {
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [
      schema.text('Hello '),
      schema.text('World', [schema.mark('strong')]),
      schema.text(' 😀İ'),
      schema.node('hard_break'),
      schema.text('World')
    ])
  ])
  assert.deepEqual(findRichText(doc, 'hello world', false), [{ from: 1, to: 12 }])
  assert.equal(findRichText(doc, 'hello', true).length, 0)
  const matches = findRichText(doc, 'World', true)
  assert.equal(matches.length, 2)
  for (const match of matches) assert.equal(doc.textBetween(match.from, match.to), 'World')
  const emoji = findRichText(doc, '😀', false)[0]
  assert.equal(emoji && doc.textBetween(emoji.from, emoji.to), '😀')
})

test('Write search treats metacharacters literally and bounds result work', () => {
  const doc = schema.node('doc', null, [
    schema.node('paragraph', null, [schema.text('a.b [x] '.repeat(1000))])
  ])
  assert.equal(findRichText(doc, 'a.b', false).length, 500)
  assert.equal(findRichText(doc, '[x]', false).length, 500)
  assert.equal(findRichText(doc, '', false).length, 0)
  assert.equal(findRichText(doc, 'x'.repeat(1001), false).length, 0)
})

test('range search finds UTF-8 text across range boundaries and observes cancellation', async () => {
  const bytes = Buffer.from(`${'x'.repeat(65533)}😀needle\n${'x'.repeat(65536)}`)
  const read = (offset: number) =>
    readTextRange(bytes.length, offset, async (target, at) => {
      const chunk = bytes.subarray(at, at + target.length)
      target.set(chunk)
      return chunk.length
    })
  const result = await searchRanges(
    read,
    '😀needle',
    0,
    bytes.length,
    new AbortController().signal,
    () => undefined
  )
  assert.equal(result.match, 65533)
  const next = await searchRanges(
    read,
    'missing',
    result.next,
    bytes.length,
    new AbortController().signal,
    () => undefined
  )
  assert.equal(next.done, true)
  assert.equal(next.match, null)
  const controller = new AbortController()
  await assert.rejects(() =>
    searchRanges(
      async offset => {
        controller.abort()
        return read(offset)
      },
      'needle',
      0,
      bytes.length,
      controller.signal,
      () => undefined
    )
  )
  await assert.rejects(
    () => searchRanges(read, '', 0, bytes.length, new AbortController().signal, () => undefined),
    /characters/
  )
})

test('range search pauses after an 8 MiB section and rejects non-advancing readers', async () => {
  let reads = 0
  const size = 10 * 1024 * 1024 * 1024
  const result = await searchRanges(
    async offset => {
      reads++
      return { offset, nextOffset: offset + 65536, text: 'x'.repeat(65536) }
    },
    'missing',
    0,
    size,
    new AbortController().signal,
    () => undefined
  )
  assert.equal(result.next, 8 * 1024 * 1024 - 'missing'.length)
  assert.equal(result.done, false)
  assert.equal(reads, 128)
  await assert.rejects(
    () =>
      searchRanges(
        async offset => ({ offset, nextOffset: offset, text: '' }),
        'x',
        0,
        100,
        new AbortController().signal,
        () => undefined
      ),
    /advance/
  )
})

test('continuing range search retains overlap at the 8 MiB work boundary', async () => {
  const boundary = 8 * 1024 * 1024
  const bytes = Buffer.from(`${'x'.repeat(boundary - 3)}needle${'x'.repeat(100)}`)
  const read = (offset: number) =>
    readTextRange(bytes.length, offset, async (target, at) => {
      const chunk = bytes.subarray(at, at + target.length)
      target.set(chunk)
      return chunk.length
    })
  const signal = new AbortController().signal
  const first = await searchRanges(read, 'needle', 0, bytes.length, signal, () => undefined)
  assert.equal(first.match, null)
  assert.equal(first.done, false)
  const second = await searchRanges(
    read,
    'needle',
    first.next,
    bytes.length,
    signal,
    () => undefined
  )
  assert.equal(second.match, boundary - 3)
})
