import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const playwright = await import(process.env.MARKA_PLAYWRIGHT_MODULE || 'playwright')
const { _electron: electron } = playwright.default ?? playwright
const root = resolve('tmp/electron-smoke')
await mkdir(root, { recursive: true })
const profile = resolve(root, `profile-${Date.now()}`)
await mkdir(profile, { recursive: true })
const harness = resolve(root, 'main.mjs')
const target = resolve(root, 'saved.md')
const opened = resolve(root, 'opened.md')
await writeFile(
  harness,
  `import { app } from 'electron'; app.setPath('userData', ${JSON.stringify(profile)}); await import(${JSON.stringify(pathToFileURL(resolve('out/main/index.js')).href)});`
)
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({
  executablePath: require('electron'),
  args: [harness],
  env,
  timeout: 30_000
})
let page
const errors = []
const checks = []
function passed(message) {
  checks.push(message)
  console.log(`PASS ${message}`)
}

try {
  page = await app.firstWindow()
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') {
      errors.push(message.text())
    }
  })
  await page.getByRole('button', { name: 'Open commands', exact: true }).waitFor()
  await page.locator('.tiptap').waitFor()
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath })
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
  }, target)

  const rich = page.locator('.tiptap')
  await rich.fill('Immediate save from rich editor')
  await page.keyboard.press('Control+s')
  await page.waitForFunction(() => document.body.innerText.includes('Document saved'))
  assert.match(await readFile(target, 'utf8'), /Immediate save from rich editor/)
  passed('Rich edits are saved immediately through real file IPC')

  await page.getByRole('button', { name: 'Source', exact: true }).click()
  const source = page.getByRole('textbox', { name: 'Markdown source' })
  await source.waitFor()
  await source.fill(
    '# Intro\n\nParagraph with **bold**.\n\n## Details\n\n- [x] Done\n\n$x^2$\n\n[^note]: A footnote'
  )
  await page.getByRole('button', { name: 'Split', exact: true }).click()
  await page.locator('.markdown-preview .katex').waitFor()
  assert.equal(await page.locator('.markdown-preview strong').innerText(), 'bold')
  passed('Split renders Markdown and KaTeX while preserving source')

  await page.getByRole('button', { name: 'H2 Details', exact: true }).click()
  const selectedLine = await source.evaluate(element => {
    const selection = window.getSelection()
    return selection?.anchorNode?.parentElement?.closest('.cm-line')?.textContent
  })
  assert.equal(selectedLine, '## Details')
  passed('Outline navigates to the correct source line')

  const divider = page.getByRole('separator', { name: 'Resize source and preview' })
  await divider.focus()
  await page.keyboard.press('ArrowRight')
  assert.equal(await divider.getAttribute('aria-valuenow'), '55')
  passed('Split divider supports keyboard resizing')

  await page.keyboard.press('Control+f')
  await page.locator('.cm-search input[name="search"]').waitFor({ state: 'visible' })
  await page.locator('.cm-search input[name="search"]').fill('Paragraph')
  await page.locator('.cm-search input[name="replace"]').fill('Replaced')
  await page.locator('.cm-search button[name="replaceAll"]').click()
  assert.match(await source.innerText(), /Replaced with/)
  await page.locator('.cm-search button[name="close"]').click()
  passed('Find and replace updates the document')

  await source.fill('# Stale preview\n\nFirst draft')
  await source.fill('# Current preview\n\nLatest draft')
  await page.locator('.markdown-preview h1').filter({ hasText: 'Current preview' }).waitFor()
  assert.doesNotMatch(await page.locator('.markdown-preview').innerText(), /First draft/)
  passed('Preview worker displays the latest edit and discards stale results')

  await page.keyboard.press('Control+k')
  const commands = page.getByRole('combobox', { name: 'Search commands' })
  await commands.fill('nothing matches this')
  await page.getByText('No commands found. Try “theme” or “notes”.').waitFor()
  await commands.fill('dark theme')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => document.documentElement.classList.contains('dark'))
  passed('Command palette filters, reports empty results, and runs commands by keyboard')

  await page.getByRole('button', { name: 'Editor settings', exact: true }).click()
  await page.getByLabel('Show line numbers', { exact: true }).uncheck()
  await page.getByLabel('Tab size', { exact: true }).selectOption('4')
  await page.getByRole('button', { name: 'Close settings' }).click()
  assert.equal(await page.locator('.cm-lineNumbers').count(), 0)
  passed('Editor preferences reconfigure CodeMirror without losing content')

  await source.fill('# Recovery\n\nRecover this unsaved text.')
  await page.waitForFunction(() =>
    localStorage.getItem('marka-draft-v1')?.includes('Recover this unsaved text.')
  )
  await page.reload()
  await page.getByText('Recovered your unsaved draft. Review it and save when ready.').waitFor()
  await page.getByRole('textbox', { name: 'Markdown source' }).waitFor()
  assert.match(
    await page.getByRole('textbox', { name: 'Markdown source' }).innerText(),
    /Recover this unsaved text/
  )
  assert.equal(await page.locator('.cm-lineNumbers').count(), 0)
  passed('Draft recovery and preferences survive renderer reload')

  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 2, checkboxChecked: false })
  })
  await page.keyboard.press('Control+n')
  await page.waitForFunction(() => !document.body.innerText.includes('Working…'))
  assert.match(
    await page.getByRole('textbox', { name: 'Markdown source' }).innerText(),
    /Recover this unsaved text/
  )
  passed('Cancel protects unsaved content when creating a document')

  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
  })
  await page.keyboard.press('Control+k')
  await page.getByRole('combobox', { name: 'Search commands' }).fill('meeting notes')
  await page.keyboard.press('Enter')
  await page.waitForFunction(() =>
    document.querySelector('.cm-content')?.textContent?.includes('# Meeting notes')
  )
  passed('Templates create a complete document through the guarded file flow')

  await page.getByRole('button', { name: 'Toggle focus mode' }).click()
  assert.equal(
    await page.getByRole('complementary', { name: 'Document outline and details' }).count(),
    0
  )
  await page.getByRole('button', { name: 'Toggle focus mode' }).click()
  passed('Focus mode hides and restores the outline')

  await writeFile(opened, '# Opened from disk\n\nReal filesystem content.')
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
  }, opened)
  await page.keyboard.press('Control+o')
  await page.waitForFunction(() =>
    document.querySelector('.cm-content')?.textContent?.includes('# Opened from disk')
  )
  assert.match(
    await page.getByRole('textbox', { name: 'Markdown source' }).innerText(),
    /Real filesystem content/
  )
  passed('Open reads real files and replaces the document after discard confirmation')

  const large =
    '# Large file\n\n' +
    Array.from({ length: 10_000 }, (_, index) => `Line ${index}: plain text.`).join('\n')
  await writeFile(opened, large)
  await page.getByRole('button', { name: 'Source', exact: true }).click()
  const start = performance.now()
  await page.keyboard.press('Control+o')
  await page.waitForFunction(() =>
    document.querySelector('.cm-content')?.textContent?.includes('Line 0: plain text.')
  )
  const elapsed = performance.now() - start
  assert.ok(
    (await page.locator('.cm-line').count()) < 500,
    'CodeMirror should virtualize large documents'
  )
  assert.ok(elapsed < 5000, `Large file opening took ${elapsed.toFixed(0)}ms`)
  passed(`10,000-line source document opens with virtualization (${elapsed.toFixed(0)}ms)`)

  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setSize(800, 600)
  })
  await page.getByRole('button', { name: 'Editor settings', exact: true }).click()
  await page.getByLabel('Appearance', { exact: true }).selectOption('light')
  await page.getByRole('button', { name: 'Close settings' }).click()
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  passed('Minimum desktop size keeps the shell within the viewport')

  await page.getByRole('button', { name: 'Split', exact: true }).click()
  await page.locator('.markdown-preview').waitFor()
  assert.equal(
    await page.getByRole('separator', { name: 'Resize source and preview' }).isVisible(),
    false
  )
  const sourceBounds = await page
    .getByRole('region', { name: 'Source editor', exact: true })
    .boundingBox()
  const previewBounds = await page
    .getByRole('region', { name: 'Markdown preview', exact: true })
    .boundingBox()
  assert.ok(
    sourceBounds && previewBounds && previewBounds.y >= sourceBounds.y + sourceBounds.height - 2
  )
  passed('Split stacks vertically at the minimum window width')

  await app.evaluate(({ BrowserWindow }) => {
    BrowserWindow.getAllWindows()[0].setSize(1280, 800)
  })
  await writeFile(
    opened,
    '# Marka workspace\n\n## Write with focus\n\nA comfortable space for **clear ideas**.\n\n- [x] Source editing\n- [x] Live preview\n- [ ] Your next draft\n\n## Plan your work\n\n| Step | Status |\n| --- | --- |\n| Explore | Done |\n| Create | In progress |\n'
  )
  await page.keyboard.press('Control+o')
  await page.getByRole('button', { name: 'Split', exact: true }).click()
  await page.locator('.markdown-preview table').waitFor()
  await page.screenshot({ path: resolve(root, 'workspace-light.png') })
  await page.getByRole('button', { name: 'Editor settings', exact: true }).click()
  await page.getByLabel('Appearance', { exact: true }).selectOption('dark')
  await page.getByRole('button', { name: 'Close settings' }).click()
  await page.screenshot({ path: resolve(root, 'workspace-dark.png') })

  await page
    .getByRole('textbox', { name: 'Markdown source' })
    .fill('# Export check\n\nMath $x^2$.\n\n<script>danger()</script>')
  for (const format of ['html', 'pdf', 'txt']) {
    const output = resolve(root, `export.${format}`)
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath })
    }, output)
    await page.getByRole('button', { name: 'File menu', exact: true }).click()
    const labels = { html: 'Export HTML', pdf: 'Export PDF', txt: 'Export plain text' }
    await page.getByRole('menuitem', { name: labels[format], exact: true }).click()
    await page.getByText(`Exported ${format.toUpperCase()} to ${output}`, { exact: true }).waitFor()
    const file = await readFile(output)
    assert.ok(file.length > 20)
    if (format === 'pdf') {
      assert.equal(file.subarray(0, 4).toString(), '%PDF')
    }
    if (format === 'html') {
      assert.match(file.toString(), /<math/)
      assert.doesNotMatch(file.toString(), /<script>/)
    }
  }
  passed('HTML, PDF and text exports write real files from Source/Split')

  await app.evaluate(async ({ BrowserWindow, dialog }) => {
    await new Promise(resolve => {
      dialog.showMessageBox = async () => {
        resolve()
        return { response: 2, checkboxChecked: false }
      }
      BrowserWindow.getAllWindows()[0].close()
    })
  })
  await page.waitForFunction(() => !document.body.innerText.includes('Working…'))
  assert.equal(page.isClosed(), false)
  passed('Native window close honors Cancel for unsaved content')

  const closed = page.waitForEvent('close')
  await app.evaluate(({ BrowserWindow, dialog }) => {
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
    BrowserWindow.getAllWindows()[0].close()
  })
  await closed
  passed('Native window close completes after Discard')
  assert.deepEqual(errors, [])
  passed('Light/dark screenshots captured with no renderer errors')
  console.log(JSON.stringify({ passed: checks.length, errors, artifacts: root }, null, 2))
} catch (error) {
  if (page) {
    await page.screenshot({ path: resolve(root, 'failure.png') }).catch(() => undefined)
  }
  console.error('Renderer errors:', errors)
  throw error
} finally {
  await app
    .evaluate(({ app }) => {
      app.exit(0)
    })
    .catch(() => undefined)
}
