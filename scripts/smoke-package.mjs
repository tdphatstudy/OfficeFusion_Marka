import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { _electron as electron } from 'playwright'

const require = createRequire(import.meta.url)
const builder = createRequire(require.resolve('electron-builder'))
const lib = createRequire(builder.resolve('app-builder-lib'))
const asar = lib('@electron/asar')
const archive = resolve('dist/win-unpacked/resources/app.asar')
const entries = asar.listPackage(archive).map(path => path.replaceAll('\\', '/'))
const roots = new Set(entries.map(path => path.split('/').filter(Boolean)[0]))
for (const root of roots) {
  assert.ok(
    ['out', 'resources', 'package.json', 'node_modules'].includes(root),
    `Unexpected packaged root: ${root}`
  )
}
for (const file of ['/out/main/index.js', '/out/main/exportWorker.js', '/out/preload/index.cjs']) {
  assert.ok(entries.includes(file), `Missing runtime asset: ${file}`)
}
console.log(
  'PASS ASAR includes runtime workers/preload and excludes project sources, private research and fixtures'
)

const root = resolve('tmp/package-smoke')
await mkdir(root, { recursive: true })
const profile = resolve(root, `profile-${Date.now()}`)
await mkdir(profile, { recursive: true })
const harness = resolve(root, 'main.mjs')
await writeFile(
  harness,
  `import { app } from 'electron'; app.setPath('userData', ${JSON.stringify(profile)}); globalThis.mainErrors=[]; process.on('uncaughtException',e=>globalThis.mainErrors.push(e.message)); await import(${JSON.stringify(pathToFileURL(`${archive}/out/main/index.js`).href)});`
)
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({
  executablePath: require('electron'),
  args: [harness],
  env,
  timeout: 30_000
})
try {
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.getByRole('button', { name: 'Open commands', exact: true }).waitFor()
  assert.equal(page.url(), 'marka://app/index.html')
  const pdf = resolve(root, 'packaged.pdf')
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath })
  }, pdf)
  assert.equal(await page.evaluate(() => window.api.exportPdf('# Archive worker\n\n$E=mc^2$')), pdf)
  assert.equal((await readFile(pdf)).subarray(0, 5).toString(), '%PDF-')
  await page.getByRole('button', { name: 'Split', exact: true }).click()
  await page.locator('.markdown-preview').getByText('Welcome to Marka', { exact: true }).waitFor()
  assert.deepEqual(errors, [])
  assert.deepEqual(await app.evaluate(() => globalThis.mainErrors), [])
  console.log(
    'PASS Compiled ASAR app loads its sandbox preload, preview worker and PDF export worker'
  )
} finally {
  await app
    .evaluate(({ app }) => {
      setTimeout(() => app.exit(0), 0)
    })
    .catch(() => undefined)
  await app.close().catch(() => undefined)
}
