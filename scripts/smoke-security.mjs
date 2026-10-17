import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { _electron as electron } from 'playwright'
import { waitForDraft } from './smoke-helpers.mjs'

const require = createRequire(import.meta.url)
const root = resolve('tmp/security-smoke')
await mkdir(root, { recursive: true })
const profile = resolve(root, `profile-${Date.now()}`)
await mkdir(profile, { recursive: true })
const harness = resolve(root, 'main.mjs')
await writeFile(
  harness,
  `import { app } from 'electron'; globalThis.mainErrors=[]; process.on('uncaughtException',error=>globalThis.mainErrors.push(error.message)); process.on('unhandledRejection',error=>globalThis.mainErrors.push(String(error))); app.setPath('userData', ${JSON.stringify(profile)}); await import(${JSON.stringify(pathToFileURL(resolve('out/main/index.js')).href)});`
)
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const seedHarness = resolve(root, 'seed.mjs')
const legacyURL = pathToFileURL(resolve('out/renderer/index.html')).href
await writeFile(
  seedHarness,
  `
import { app, BrowserWindow, protocol, session } from 'electron';
app.setPath('userData', ${JSON.stringify(profile)});
app.whenReady().then(async () => {
  protocol.handle('file', () => new Response('<meta http-equiv="Content-Security-Policy" content="default-src \\'none\\'">'));
  const window = new BrowserWindow({show:false, webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,javascript:false}});
  window.webContents.debugger.attach('1.3');
  await window.loadURL(${JSON.stringify(legacyURL)});
  const debug = window.webContents.debugger;
  await debug.sendCommand('DOMStorage.enable');
  const {frameTree} = await debug.sendCommand('Page.getFrameTree');
  const {storageKey} = await debug.sendCommand('Storage.getStorageKeyForFrame',{frameId:frameTree.frame.id});
  const storageId = {storageKey,isLocalStorage:true};
  for (const [key,value] of Object.entries(${JSON.stringify({
    'marka-draft-v1': JSON.stringify({
      content: '# Legacy upgrade draft',
      savedContent: '# Original baseline',
      filePath: null
    }),
    'marka-editor': JSON.stringify({
      state: { viewMode: 'source', config: { fontSize: 17 } },
      version: 0
    }),
    'marka-ui': JSON.stringify({ state: { theme: 'light' }, version: 0 }),
    'fixture-unknown': 'Do not migrate'
  })})) { await debug.sendCommand('DOMStorage.setDOMStorageItem',{storageId,key,value}); }
  session.defaultSession.flushStorageData();
  globalThis.fixtureCompleted = true;
});`
)
const seed = await electron.launch({
  executablePath: require('electron'),
  args: [seedHarness],
  env,
  timeout: 30_000
})
await seed.evaluate(async () => {
  while (!globalThis.fixtureCompleted) {
    await new Promise(resolve => setTimeout(resolve, 20))
  }
})
await seed.close()
const app = await electron.launch({
  executablePath: require('electron'),
  args: [harness],
  env,
  timeout: 30_000
})
let page
const errors = []
const checks = []
const passed = text => {
  checks.push(text)
  console.log(`PASS ${text}`)
}
const fixture = resolve(root, 'notes.md')
const unopened = resolve(root, 'unopened.md')
const large = resolve(root, 'large.md')
const invalid = resolve(root, 'invalid.md')
const pdf = resolve(root, 'safe.pdf')
await writeFile(fixture, '# Original')
await writeFile(unopened, 'Keep unopened data')
await writeFile(large, `${'0123456789\n'.repeat(600_000)}TAIL MARKER`)
await writeFile(invalid, Buffer.from([0xff, 0xfe, 0x00]))

async function picker(filePath) {
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
  }, filePath)
}

try {
  page = await app.firstWindow()
  page.on('pageerror', error => errors.push(error.message))
  const source = () => page.getByRole('textbox', { name: 'Markdown source' })
  await source().waitFor()
  await page.waitForFunction(() =>
    document.querySelector('.cm-content')?.textContent?.includes('Legacy upgrade draft')
  )
  assert.equal(
    await page.evaluate(() => localStorage.getItem('marka-origin-migration-v1')),
    'complete'
  )
  assert.equal(await page.evaluate(() => localStorage.getItem('fixture-unknown')), null)
  assert.equal(await source().evaluate(element => getComputedStyle(element).fontSize), '17px')
  await waitForDraft(page, '# Legacy upgrade draft')
  passed('Upgrade migrates legacy file-origin drafts and preferences through an inert window')
  await page.getByRole('button', { name: 'Write', exact: true }).click()
  await page.locator('.tiptap').waitFor()
  await page.locator('.tiptap').fill('x'.repeat(100_001))
  await page
    .getByRole('alert')
    .filter({ hasText: /Edit rejected/ })
    .waitFor()
  assert.match(await page.locator('.tiptap').innerText(), /Legacy upgrade draft/)
  await page.getByRole('button', { name: 'Markdown', exact: true }).click()
  await source().waitFor()
  passed('Write mode rejects an oversized paste before replacing the existing draft')
  const imagePath = resolve(root, 'embedded-image.md')
  const imageSource =
    '![tiny](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6nT8AAAAASUVORK5CYII=)'
  await writeFile(imagePath, imageSource)
  await picker(imagePath)
  await page.keyboard.press('Control+o')
  await page.waitForFunction(() =>
    document.querySelector('.cm-content')?.textContent?.includes('data:image/png')
  )
  await page.getByRole('button', { name: 'Write', exact: true }).click()
  assert.equal(await page.locator('.tiptap').count(), 0)
  await source().press('Control+End')
  await page.keyboard.type(' preserved')
  await page.keyboard.insertText('🙂')
  await page.keyboard.press('Control+s')
  await page.getByText('Document saved', { exact: true }).waitFor()
  assert.equal(await readFile(imagePath, 'utf8'), `${imageSource} preserved🙂`)
  passed('Embedded image source survives guarded mode switching, editing and Save')
  const settings = await app.evaluate(({ BrowserWindow }) => {
    const preferences = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences()
    return {
      sandbox: preferences.sandbox,
      isolated: preferences.contextIsolation,
      node: preferences.nodeIntegration,
      electron: process.versions.electron
    }
  })
  assert.equal(settings.sandbox, true)
  assert.equal(settings.isolated, true)
  assert.equal(settings.node, false)
  assert.match(settings.electron, /^44\./)
  assert.equal(new URL(page.url()).protocol, 'marka:')
  assert.equal(await page.evaluate(() => typeof window.api.readFile), 'undefined')
  passed('Supported Electron runs an isolated sandbox with a scoped bridge and application origin')

  const untrusted = await app.evaluate(async ({ BrowserWindow }, preload) => {
    const window = new BrowserWindow({
      show: false,
      webPreferences: { preload, sandbox: true, contextIsolation: true, nodeIntegration: false }
    })
    try {
      await window.loadURL('data:text/html,<p>untrusted fixture</p>')
      return await window.webContents.executeJavaScript(
        `window.api.openFile().then(() => 'allowed', error => error.message)`
      )
    } finally {
      window.destroy()
    }
  }, resolve('out/preload/index.cjs'))
  assert.match(untrusted, /Untrusted|trusted|denied/i)
  passed('An unregistered renderer cannot invoke privileged file dialogs')

  const denied = await page.evaluate(async path => {
    try {
      await window.api.saveFile('Injected overwrite', path, 'Keep unopened data')
      return 'allowed'
    } catch (error) {
      return error.message
    }
  }, unopened)
  assert.match(denied, /expired|baseline/)
  assert.equal(await readFile(unopened, 'utf8'), 'Keep unopened data')
  passed('Renderer-supplied paths cannot overwrite unopened files')

  const malformed = await page.evaluate(async () => {
    const attempts = [
      () => window.api.saveFile({ content: 'bad' }),
      () => window.api.saveFile('\uD800'),
      () => window.api.readPage('invented', -1),
      () => window.api.exportHtml('x'.repeat(512 * 1024 + 1))
    ]
    return Promise.all(
      attempts.map(async action => {
        try {
          await action()
          return false
        } catch {
          return true
        }
      })
    )
  })
  assert.deepEqual(malformed, [true, true, true, true])
  passed('Malformed, oversized and invented-handle IPC requests are rejected')

  await picker(fixture)
  await page.keyboard.press('Control+o')
  await page.waitForFunction(() =>
    document.querySelector('.cm-content')?.textContent?.includes('# Original')
  )
  await source().fill('# My dirty edits')
  await writeFile(fixture, '# External edit')
  await page.keyboard.press('Control+s')
  await page.getByText(/File changed on disk/).waitFor()
  assert.equal(await readFile(fixture, 'utf8'), '# External edit')
  assert.match(await source().innerText(), /My dirty edits/)
  await waitForDraft(page, '# My dirty edits')
  passed('External writers trigger a conflict while dirty text and its recovery checkpoint survive')

  await picker(invalid)
  await page.keyboard.press('Control+o')
  await page.getByText(/Choose a UTF-8/).waitFor()
  assert.match(await source().innerText(), /My dirty edits/)
  passed('Invalid encodings cannot silently replace a dirty document')

  await waitForDraft(page, '# My dirty edits')
  const sessionBefore = await page.evaluate(() => sessionStorage.getItem('marka-session'))
  await page.reload()
  await source().waitFor()
  assert.equal(await page.evaluate(() => sessionStorage.getItem('marka-session')), sessionBefore)
  await page.waitForFunction(() =>
    document.querySelector('.cm-content')?.textContent?.includes('My dirty edits')
  )
  assert.match(await source().innerText(), /My dirty edits/)
  const expired = await page.evaluate(async path => {
    try {
      await window.api.saveFile('# Dirty recovered', path, '# Original')
      return 'allowed'
    } catch (error) {
      return error.message
    }
  }, fixture)
  assert.match(expired, /expired/)
  passed('Reload restores this session draft and expires native file grants')

  await picker(large)
  await page.keyboard.press('Control+o')
  await page.getByRole('region', { name: 'Large file viewer' }).waitFor()
  const range = page.getByLabel('File range', { exact: true })
  await page.waitForFunction(
    () => document.querySelector('[aria-label="File range"]')?.textContent?.length > 0
  )
  assert.ok((await range.innerText()).length <= 65536)
  assert.equal(await source().count(), 0)
  await page.getByRole('button', { name: 'Next range', exact: true }).click()
  await page.getByRole('button', { name: 'Go to byte', exact: true }).waitFor({ state: 'visible' })
  await page.getByLabel('Byte offset', { exact: true }).fill(String(6_600_000))
  await page.getByRole('button', { name: 'Go to byte', exact: true }).click()
  await page.waitForFunction(() =>
    document.querySelector('[aria-label="File range"]')?.textContent?.includes('TAIL MARKER')
  )
  await page.getByRole('button', { name: 'File menu', exact: true }).click()
  assert.equal(
    await page.getByRole('menuitem', { name: /^Save as/ }).getAttribute('data-disabled'),
    ''
  )
  assert.equal(
    await page
      .getByRole('menuitem', { name: 'Export PDF', exact: true })
      .getAttribute('data-disabled'),
    ''
  )
  await page.keyboard.press('Escape')
  passed('Large files load bounded ranges, jump to the tail and disable destructive editor actions')

  await writeFile(large, '# Changed while viewing')
  await page.getByLabel('Byte offset', { exact: true }).fill('0')
  await page.getByRole('button', { name: 'Go to byte', exact: true }).click()
  await page
    .getByRole('alert')
    .filter({ hasText: /changed during viewing/ })
    .waitFor()
  await page.screenshot({ animations: 'disabled', path: resolve(root, 'paged-change.png') })
  passed('Paged reads detect external mutation instead of mixing file versions')

  const keyDenied = await page.evaluate(async () => {
    try {
      await window.api.openConnectedDocument(
        {
          kind: 'ssh',
          host: '127.0.0.1',
          port: 1,
          path: '/fixture.md',
          fingerprint: 'SHA256:' + 'A'.repeat(43)
        },
        { method: 'key', keyPath: 'C:\\fixture-only\\unselected-key' }
      )
      return 'allowed'
    } catch (error) {
      return error.message
    }
  })
  assert.match(keyDenied, /file picker/)
  passed('SSH private keys require an explicit native selection before any connection')

  await app.evaluate(({ dialog, app, BrowserWindow }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath })
    globalThis.printChecks = []
    const owner = BrowserWindow.getAllWindows()[0].id
    app.on('browser-window-created', (_event, window) => {
      if (window.id === owner) {
        return
      }
      const p = window.webContents.getLastWebPreferences()
      globalThis.printChecks.push({
        sandbox: p.sandbox,
        javascript: p.javascript,
        preload: p.preload,
        node: p.nodeIntegration
      })
    })
  }, pdf)
  assert.equal(
    await page.evaluate(() =>
      window.api.exportPdf(
        '# Safe export\n\n<script>document.body.dataset.injected="yes"</script>\n\n<img src="file:///C:/fixture-only/private.png" onerror="alert(1)">'
      )
    ),
    pdf
  )
  assert.match((await readFile(pdf)).subarray(0, 5).toString(), /%PDF-/)
  const print = await app.evaluate(({ BrowserWindow }) => ({
    windows: BrowserWindow.getAllWindows().length,
    checks: globalThis.printChecks
  }))
  assert.equal(print.windows, 1)
  assert.ok(
    print.checks.some(
      p => p.sandbox === true && p.javascript === false && p.node === false && !p.preload
    )
  )
  passed('PDF export sanitizes Markdown in a script-disabled sandbox and destroys the print window')
  assert.deepEqual(errors, [])
  assert.deepEqual(await app.evaluate(() => globalThis.mainErrors), [])
  console.log(JSON.stringify({ passed: checks.length, artifacts: root }, null, 2))
} catch (error) {
  if (page) {
    await page.screenshot({ path: resolve(root, 'failure.png') }).catch(() => undefined)
    console.error(
      await page
        .locator('body')
        .innerText()
        .catch(() => 'closed')
    )
  }
  throw error
} finally {
  await app
    .evaluate(({ app }) => {
      setTimeout(() => app.exit(0), 0)
    })
    .catch(() => undefined)
  await app.close().catch(() => undefined)
}
