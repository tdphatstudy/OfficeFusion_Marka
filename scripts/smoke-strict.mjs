import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join, sep, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { _electron } from 'playwright'

const root = resolve('tmp/strict-smoke')
const renderer = join(root, 'renderer')
const folder = join(root, 'files')
await mkdir(folder, { recursive: true })
await writeFile(join(folder, 'notes.md'), '# StrictMode fixture')
const large = join(folder, 'large.md')
await writeFile(large, '# Range fixture\n'.repeat(400000))
const require = createRequire(import.meta.url)
const katex = createRequire(require.resolve('rehype-katex')).resolve('katex/dist/katex.min.css')
await build({
  configFile: false,
  root: resolve('src/renderer'),
  mode: 'development',
  logLevel: 'warn',
  define: { 'process.env.NODE_ENV': JSON.stringify('development') },
  plugins: [
    {
      name: 'strict-mode-test-probe',
      enforce: 'pre',
      transform(code, id) {
        const source = id.replaceAll('\\', '/')
        if (
          source === resolve('src/renderer/components/layout/FileBrowser.tsx').replaceAll('\\', '/')
        ) {
          return code.replace(
            'const [history, setHistory]',
            'window.__browserSessionId = session.id; const [history, setHistory]'
          )
        }
        if (
          source === resolve('src/renderer/components/editor/PagedViewer.tsx').replaceAll('\\', '/')
        ) {
          return code.replace(
            'const [offset, setOffset]',
            'window.__readerHandle = document.handle; const [offset, setOffset]'
          )
        }
        if (source !== resolve('src/renderer/main.tsx').replaceAll('\\', '/')) return
        return (
          code.replace('<App />', '<StrictProbe /><App />') +
          `\nfunction StrictProbe() { React.useEffect(() => { window.__strictProbe ??= { setups: 0, cleanups: 0 }; window.__strictProbe.setups++; return () => { window.__strictProbe.cleanups++ } }, []); return null }`
        )
      }
    },
    react()
  ],
  resolve: {
    conditions: ['browser', 'module', 'development'],
    alias: { '@': resolve('src/renderer'), 'katex/dist/katex.min.css': katex }
  },
  build: { outDir: renderer, emptyOutDir: true, minify: false, sourcemap: false }
})
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname
    const file = resolve(
      renderer,
      `.${pathname === '/' ? '/index.html' : decodeURIComponent(pathname)}`
    )
    if (!file.startsWith(`${renderer}${sep}`)) {
      response.writeHead(403)
      response.end()
      return
    }
    const types = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.woff2': 'font/woff2',
      '.woff': 'font/woff'
    }
    response.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream')
    response.end(await readFile(file))
  } catch {
    response.writeHead(404)
    response.end()
  }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const profile = join(root, `profile-${Date.now()}`)
const harness = join(root, 'main.mjs')
await writeFile(
  harness,
  `import { app } from 'electron'; app.setPath('userData', ${JSON.stringify(profile)}); await import(${JSON.stringify(pathToFileURL(resolve('out/main/index.js')).href)});`
)
const env = { ...process.env, ELECTRON_RENDERER_URL: `http://127.0.0.1:${server.address().port}/` }
delete env.ELECTRON_RUN_AS_NODE
let app
const expectedFailure = process.argv.includes('--expect-expired')
try {
  app = await _electron.launch({
    executablePath: require('electron'),
    args: [harness],
    env,
    timeout: 30000
  })
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.locator('.tiptap').waitFor()
  assert.deepEqual(await page.evaluate(() => window.__strictProbe), { setups: 2, cleanups: 1 })
  console.log('PASS Development React actually replays StrictMode effects')
  await app.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] })
  }, folder)
  await page.getByRole('button', { name: 'Open connections', exact: true }).click()
  await page.getByRole('button', { name: 'Browse a folder', exact: true }).click()
  if (expectedFailure) {
    await page
      .getByRole('alert')
      .filter({ hasText: /Folder session expired/ })
      .waitFor()
    console.log('REPRODUCED Browser session is revoked by StrictMode effect cleanup')
  } else {
    await page.getByRole('button', { name: 'File notes.md', exact: true }).waitFor()
    await page.getByRole('button', { name: 'Refresh folder', exact: true }).click()
    await page.getByRole('button', { name: 'File notes.md', exact: true }).waitFor()
    console.log('PASS Browser survives StrictMode replay and can refresh its live session')
  }
  const browserId = await page.evaluate(() => window.__browserSessionId)
  assert.equal(typeof browserId, 'string')
  await page.getByRole('button', { name: 'Close connections', exact: true }).click()
  if (!expectedFailure) {
    const closed = await page.evaluate(
      async ({ id, path }) => {
        try {
          await window.api.listFolder(id, {
            path,
            filter: '',
            hidden: false,
            markdownOnly: true,
            offset: 0
          })
          return ''
        } catch (error) {
          return error.message
        }
      },
      { id: browserId, path: folder }
    )
    assert.match(closed, /expired/)
    console.log('PASS Closing the connection hub still revokes its browser session')
  }
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
  }, large)
  await page.keyboard.press('Control+o')
  await page.getByRole('region', { name: 'Large file viewer' }).waitFor()
  if (expectedFailure) {
    await page
      .getByRole('alert')
      .filter({ hasText: /expired|closed|EBADF/i })
      .waitFor()
    console.log('REPRODUCED Large-file reader is also revoked by StrictMode effect cleanup')
  } else {
    await page
      .getByLabel('File range', { exact: true })
      .filter({ hasText: 'Range fixture' })
      .waitFor()
    await page.getByRole('button', { name: 'Next range', exact: true }).click()
    await page.waitForFunction(
      () => Number(document.querySelector('[aria-label="Byte offset"]')?.value) > 0
    )
    console.log('PASS Large-file reader survives StrictMode replay and loads the next range')
    const reader = await page.evaluate(() => window.__readerHandle)
    assert.equal(typeof reader, 'string')
    await page.keyboard.press('Control+n')
    await page.locator('.tiptap').waitFor()
    const released = await page.evaluate(async handle => {
      try {
        await window.api.readPage(handle, 0)
        return ''
      } catch (error) {
        return error.message
      }
    }, reader)
    assert.match(released, /expired/)
    console.log('PASS Replacing the document still releases its previous range reader')
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] })
    }, folder)
    const first = await page.evaluate(() => window.api.startBrowser({ kind: 'local' }))
    const second = await page.evaluate(() => window.api.startBrowser({ kind: 'local' }))
    assert.ok(first && second)
    const stale = await page.evaluate(
      async ({ id, path }) => {
        try {
          await window.api.listFolder(id, {
            path,
            filter: '',
            hidden: false,
            markdownOnly: true,
            offset: 0
          })
          return ''
        } catch (error) {
          return error.message
        }
      },
      { id: first.id, path: first.home }
    )
    assert.match(stale, /expired/)
    const listing = await page.evaluate(
      ({ id, path }) =>
        window.api.listFolder(id, {
          path,
          filter: '',
          hidden: false,
          markdownOnly: true,
          offset: 0
        }),
      { id: second.id, path: second.home }
    )
    assert.equal(
      listing.entries.some(entry => entry.name === 'notes.md'),
      true
    )
    await page.evaluate(id => window.api.closeBrowser(id), second.id)
    const closed = await page.evaluate(
      async ({ id, path }) => {
        try {
          await window.api.listFolder(id, {
            path,
            filter: '',
            hidden: false,
            markdownOnly: true,
            offset: 0
          })
          return ''
        } catch (error) {
          return error.message
        }
      },
      { id: second.id, path: second.home }
    )
    assert.match(closed, /expired/)
    console.log(
      'PASS A stale session cannot revoke its replacement; explicit close still revokes access'
    )
  }
  assert.deepEqual(errors, [])
} finally {
  if (app) {
    await app
      .evaluate(({ app }) => {
        setTimeout(() => app.exit(0), 0)
      })
      .catch(() => {})
    await app.close().catch(() => {})
  }
  server.closeAllConnections()
  await new Promise(resolve => server.close(resolve))
}
