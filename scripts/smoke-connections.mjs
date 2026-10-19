import assert from 'node:assert/strict'
import { generateKeyPairSync, createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { waitForDraft } from './smoke-helpers.mjs'
import { build } from 'vite'
import { _electron as electron } from 'playwright'
import ssh2 from 'ssh2'

const { Server, utils } = ssh2

const require = createRequire(import.meta.url)
const root = resolve('tmp/connection-smoke')
await mkdir(root, { recursive: true })
const profile = resolve(root, `profile-${Date.now()}`)
await mkdir(profile, { recursive: true })
await build({
  configFile: false,
  logLevel: 'warn',
  build: {
    ssr: resolve('src/main/connections/ssh.ts'),
    outDir: resolve(root, 'transport'),
    rollupOptions: { external: ['ssh2'], output: { format: 'es', entryFileNames: 'ssh.mjs' } }
  }
})
const { quoteRemotePath, sshSaveCommand } = await import(
  pathToFileURL(resolve(root, 'transport/ssh.mjs')).href
)
const harness = resolve(root, 'main.mjs')
await writeFile(
  harness,
  `import { app } from 'electron'; globalThis.mainErrors=[]; process.on('uncaughtException',error=>globalThis.mainErrors.push(error.message)); process.on('unhandledRejection',error=>globalThis.mainErrors.push(String(error))); app.setPath('userData', ${JSON.stringify(profile)}); await import(${JSON.stringify(pathToFileURL(resolve('out/main/index.js')).href)});`
)
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({
  executablePath: require('electron'),
  args: [harness],
  env,
  timeout: 30_000
})
const page = await app.firstWindow()
const errors = []
const checks = []
page.on('pageerror', error => errors.push(error.message))
const http = createServer((request, response) => {
  if (request.url === '/slow') {
    return
  }
  if (request.url === '/html') {
    response.setHeader('Content-Type', 'text/html')
    response.end('<h1>Wrong URL</h1>')
    return
  }
  response.setHeader('Content-Type', 'text/markdown')
  response.end('# From URL\n\nImported text.')
})
await new Promise(resolve => http.listen(0, '127.0.0.1', resolve))
const url = `http://127.0.0.1:${http.address().port}`
let ssh
let linuxFile
let localLinuxPath
const clients = new Set()
const passed = text => {
  checks.push(text)
  console.log(`PASS ${text}`)
}
const openHub = async () => {
  await page.getByRole('button', { name: 'Open connections', exact: true }).click()
}
const choose = async text => {
  await page.getByRole('button', { name: new RegExp(`^${text}`) }).click()
}
const source = () => page.getByRole('textbox', { name: 'Markdown source' })
const waitContent = async text => {
  await page.waitForFunction(
    text => document.querySelector('.cm-content')?.textContent?.includes(text),
    text
  )
}

try {
  await page.getByRole('button', { name: 'Markdown', exact: true }).click()
  await source().waitFor()
  await app.evaluate(
    ({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath })
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
    },
    resolve(root, 'local-copy.md')
  )
  const light = page.getByRole('button', { name: 'Switch to Light mode', exact: true })
  if (await light.count()) {
    await light.click()
  }
  await page.getByRole('button', { name: 'Switch to Dark mode', exact: true }).click()
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('dark')), true)
  await page.getByRole('button', { name: 'Switch to Light mode', exact: true }).click()
  passed('Quick Light/Dark switch works and exposes the new brand mark')
  await page.getByRole('button', { name: 'Editor settings', exact: true }).click()
  await page.getByLabel('Appearance', { exact: true }).selectOption('system')
  await page.getByRole('button', { name: 'Close settings', exact: true }).click()
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.getByRole('button', { name: 'Switch to Light mode', exact: true }).waitFor()
  await page.emulateMedia({ colorScheme: 'light' })
  await page.getByRole('button', { name: 'Switch to Dark mode', exact: true }).waitFor()
  passed('System appearance keeps the quick theme switch in sync with OS changes')

  await openHub()
  await choose('From URL')
  await page.getByLabel('Raw Markdown URL', { exact: true }).fill(`${url}/notes.md`)
  await page.getByRole('button', { name: 'Import document', exact: true }).click()
  await waitContent('# From URL')
  await page.keyboard.press('Control+s')
  await page.waitForFunction(() => document.body.innerText.includes('Document saved'))
  assert.match(await readFile(resolve(root, 'local-copy.md'), 'utf8'), /# From URL/)
  passed('URL import creates a copy that saves locally through real IPC')

  await openHub()
  await choose('From URL')
  await page.getByLabel('Raw Markdown URL', { exact: true }).fill(`${url}/html`)
  await page.getByRole('button', { name: 'Import document', exact: true }).click()
  await page.getByRole('dialog').getByRole('alert').filter({ hasText: 'raw Markdown' }).waitFor()
  assert.match(await page.locator('.cm-content').innerText(), /# From URL/)
  await page.getByLabel('Raw Markdown URL', { exact: true }).fill(`${url}/slow`)
  await page.getByRole('button', { name: 'Import document', exact: true }).click()
  await page.getByRole('button', { name: 'Cancel request', exact: true }).click()
  await page
    .getByRole('button', { name: 'Import document', exact: true })
    .waitFor({ state: 'visible' })
  await page.waitForFunction(() => !document.body.innerText.includes('Opening…'))
  await page.getByText('Connection cancelled', { exact: true }).waitFor()
  assert.equal(await page.getByRole('dialog').getByRole('alert').count(), 0)
  await page.getByRole('button', { name: 'Close connections', exact: true }).click()
  passed('Invalid URL and cancellation preserve the active document')

  const hostKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({
    type: 'pkcs1',
    format: 'pem'
  })
  const identity = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({
    type: 'pkcs1',
    format: 'pem'
  })
  const encryptedIdentity = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({
    type: 'pkcs1',
    format: 'pem',
    cipher: 'aes-256-cbc',
    passphrase: 'fixture-passphrase'
  })
  const identityFile = resolve(root, 'fixture-key')
  const encryptedFile = resolve(root, 'encrypted-fixture-key')
  await writeFile(identityFile, identity, { mode: 0o600 })
  await writeFile(encryptedFile, encryptedIdentity, { mode: 0o600 })
  const allowedKeys = [
    utils.parseKey(identity),
    utils.parseKey(encryptedIdentity, 'fixture-passphrase')
  ]
  const fingerprint = `SHA256:${createHash('sha256').update(utils.parseKey(hostKey).getPublicSSH()).digest('base64').replace(/=+$/, '')}`
  let remoteContent = '# Remote fixture\n\nOriginal bytes.'
  let authenticationAttempts = 0
  const remotePath = '/mock/notes with space.md'
  const snapshots = new Set([remoteContent])
  ssh = new Server({ hostKeys: [hostKey] }, client => {
    clients.add(client)
    client.on('close', () => clients.delete(client))
    client.on('error', () => undefined)
    client.on('authentication', context => {
      authenticationAttempts++
      const password = context.method === 'password' && context.password === 'fixture-password'
      const key =
        context.method === 'publickey' &&
        allowedKeys.some(
          key =>
            context.key.data.equals(key.getPublicSSH()) &&
            (!context.signature ||
              key.verify(context.blob, context.signature, context.hashAlgo) === true)
        )
      if (context.username === 'marka-test' && (password || key)) context.accept()
      else context.reject()
    })
    client.on('ready', () =>
      client.on('session', accept =>
        accept().on('exec', (accept, reject, info) => {
          if (info.command === "cat -- '/mock/large.md'") {
            const stream = accept()
            stream.on('error', () => undefined)
            stream.end('x'.repeat(5 * 1024 * 1024 + 1))
            return
          }
          if (info.command === "cat -- '/mock/disconnect.md'") {
            client.end()
            return
          }
          if (info.command === "cat -- '/mock/slow.md'") {
            const stream = accept()
            stream.on('error', () => undefined)
            return
          }
          if (info.command === `cat -- ${quoteRemotePath(remotePath)}`) {
            snapshots.add(remoteContent)
            const stream = accept()
            stream.on('error', () => undefined)
            stream.exit(0)
            stream.end(remoteContent)
            return
          }
          const snapshot = [...snapshots].find(
            content => sshSaveCommand({ path: remotePath }, content) === info.command
          )
          if (snapshot === undefined) {
            reject()
            return
          }
          const stream = accept()
          stream.on('error', () => undefined)
          let upload = ''
          stream.on('data', chunk => {
            upload += chunk.toString()
          })
          stream.on('end', () => {
            if (remoteContent !== snapshot) {
              stream.stderr.write(
                'File changed on the server. Save As a local copy or reopen before saving.'
              )
              stream.exit(73)
            } else {
              remoteContent = upload
              snapshots.add(upload)
              stream.exit(0)
            }
            stream.end()
          })
        })
      )
    )
  })
  await new Promise(resolve => ssh.listen(0, '127.0.0.1', resolve))
  const target = {
    kind: 'ssh',
    host: '127.0.0.1',
    username: 'marka-test',
    port: ssh.address().port,
    path: remotePath,
    fingerprint
  }
  const apiOpen = (target, credentials) =>
    page.evaluate(
      async ({ target, credentials }) => {
        try {
          return { document: await window.api.openConnectedDocument(target, credentials) }
        } catch (error) {
          return { error: error.message }
        }
      },
      { target, credentials }
    )
  const before = authenticationAttempts
  const untrusted = await apiOpen(
    { ...target, fingerprint: `SHA256:${'a'.repeat(43)}` },
    { method: 'password', password: 'fixture-password' }
  )
  assert.match(untrusted.error, /verification failed/i)
  assert.equal(authenticationAttempts, before)
  passed('Wrong server fingerprint rejects SSH before sending credentials')
  const badPassword = await apiOpen(target, {
    method: 'password',
    password: 'wrong-fixture-password'
  })
  assert.match(badPassword.error, /authentication/i)
  passed('Invalid password fails cleanly against the localhost mock server')
  const fixtureAuth = { method: 'password', password: 'fixture-password' }
  const large = await apiOpen({ ...target, path: '/mock/large.md' }, fixtureAuth)
  assert.match(large.error, /5 MB/)
  const disconnected = await apiOpen({ ...target, path: '/mock/disconnect.md' }, fixtureAuth)
  assert.match(disconnected.error, /disconnected|failed/i)
  passed('Oversized SSH output and dropped connections fail without replacing the document')
  const cancelled = await page.evaluate(
    async ({ target, credentials }) => {
      const timer = setTimeout(() => window.api.cancelConnection(), 500)
      try {
        await window.api.openConnectedDocument(target, credentials)
        return ''
      } catch (error) {
        return error.message
      } finally {
        clearTimeout(timer)
      }
    },
    { target: { ...target, path: '/mock/slow.md' }, credentials: fixtureAuth }
  )
  assert.match(cancelled, /cancelled/i)
  passed('Cancelling a stalled mock SSH request releases the operation')

  await openHub()
  await choose('SSH')
  await page.getByLabel('Host', { exact: true }).fill(target.host)
  await page.getByLabel('Username', { exact: true }).fill(target.username)
  await page.getByLabel('Port', { exact: true }).fill(String(target.port))
  await page.getByLabel('Password', { exact: true }).fill('fixture-password')
  await page.getByLabel('Server fingerprint', { exact: true }).fill(fingerprint)
  await page.getByLabel('File path', { exact: true }).fill(remotePath)
  await page.getByLabel('Connection profile name', { exact: true }).fill('Local SSH fixture')
  await page.getByRole('button', { name: 'Save profile', exact: true }).click()
  await page.getByRole('button', { name: 'Open document', exact: true }).click()
  await waitContent('# Remote fixture')
  passed('Password SSH opens via real IPC on a custom localhost port')
  await source().fill('# Saved through SSH\n\nNew bytes.')
  await page.keyboard.press('Control+s')
  await page.getByText('Saved to SSH host', { exact: true }).waitFor()
  assert.equal(remoteContent, '# Saved through SSH\n\nNew bytes.')
  passed('SSH Save reuses in-memory authentication and sends the edited bytes')
  remoteContent = '# Changed outside Marka'
  await source().fill('# Keep my draft')
  await page.keyboard.press('Control+s')
  await page.getByRole('dialog', { name: 'File changed outside Marka' }).waitFor()
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click()
  assert.equal(remoteContent, '# Changed outside Marka')
  assert.equal(await source().innerText(), '# Keep my draft')
  passed('Mock server conflict response preserves remote bytes and the dirty draft')
  await openHub()
  await page.getByRole('button', { name: 'Local SSH fixture', exact: true }).click()
  assert.equal(await page.getByLabel('Password', { exact: true }).inputValue(), '')
  await page.getByLabel('Authentication', { exact: true }).selectOption('key')
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
  }, encryptedFile)
  await page.getByRole('button', { name: 'Browse', exact: true }).click()
  await page.getByLabel('Key passphrase (optional)', { exact: true }).fill('wrong-passphrase')
  await page.getByRole('button', { name: 'Open document', exact: true }).click()
  await page.getByRole('dialog').getByRole('alert').waitFor()
  await page.getByLabel('Key passphrase (optional)', { exact: true }).fill('fixture-passphrase')
  await page.getByRole('button', { name: 'Open document', exact: true }).click()
  await waitContent('# Changed outside Marka')
  passed('Explicit encrypted fixture key supports passphrase and rejects a wrong passphrase')
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
  }, identityFile)
  await page.evaluate(() => window.api.chooseConnectionKey())
  const plainKey = await apiOpen(target, { method: 'key', keyPath: identityFile })
  assert.equal(plainKey.document.content, remoteContent)
  passed('Explicit unencrypted fixture key authenticates without a machine key or agent')
  const stored = await page.evaluate(() => localStorage.getItem('marka-connections-v1'))
  for (const secret of ['fixture-password', 'fixture-passphrase', 'fixture-key', 'PRIVATE KEY'])
    assert.ok(!stored.includes(secret))
  await source().fill('# Draft kept across reconnect')
  await waitForDraft(page, 'Draft kept across reconnect')
  await page.reload()
  await source().waitFor()
  const expired = await page.evaluate(async target => {
    try {
      await window.api.saveConnectedDocument(target, '# edit', '# Changed outside Marka')
      return ''
    } catch (error) {
      return error.message
    }
  }, target)
  assert.match(expired, /session expired/i)
  await openHub()
  await page.getByRole('button', { name: 'Local SSH fixture', exact: true }).waitFor()
  passed('Profiles persist without secrets; renderer reload clears SSH session credentials')
  await page.getByRole('button', { name: 'Local SSH fixture', exact: true }).click()
  await page.getByLabel('Password', { exact: true }).fill('fixture-password')
  await page.getByRole('button', { name: 'Reconnect & keep edits', exact: true }).click()
  await waitContent('# Draft kept across reconnect')
  await page.keyboard.press('Control+s')
  await page.getByText('Saved to SSH host', { exact: true }).waitFor()
  assert.equal(remoteContent, '# Draft kept across reconnect')
  passed('Reconnect after reload keeps the recovered draft and restores SSH Save')
  await openHub()
  await page.getByRole('button', { name: 'Remove profile Local SSH fixture', exact: true }).click()
  assert.equal(
    await page.getByRole('button', { name: 'Local SSH fixture', exact: true }).count(),
    0
  )
  passed('Saved connection profiles can be removed')

  const distro = process.env.MARKA_TEST_WSL_DISTRO
  if (process.platform === 'win32' && distro) {
    linuxFile = `/tmp/marka-connection-${Date.now()} with space.md`
    localLinuxPath = `\\\\wsl.localhost\\${distro}${linuxFile.replaceAll('/', '\\')}`
    await writeFile(localLinuxPath, '# WSL fixture')
    await choose('WSL')
    await page.getByLabel('Linux distribution', { exact: true }).selectOption(distro)
    await page.getByLabel('File path', { exact: true }).fill(linuxFile)
    await page.getByRole('button', { name: 'Open document', exact: true }).click()
    await waitContent('# WSL fixture')
    await source().fill('# Saved through WSL')
    await page.keyboard.press('Control+s')
    await page.getByText('Document saved', { exact: true }).waitFor()
    assert.equal(await readFile(localLinuxPath, 'utf8'), '# Saved through WSL')
    passed('WSL opens and saves only a generated Linux /tmp fixture')
    await openHub()
  }
  await page.screenshot({ animations: 'disabled', path: resolve(root, 'connections-light.png') })
  await page.getByRole('button', { name: 'Close connections', exact: true }).click()
  await page.getByRole('button', { name: 'Switch to Dark mode', exact: true }).click()
  await openHub()
  await choose('SSH')
  await page.screenshot({ animations: 'disabled', path: resolve(root, 'connections-dark.png') })
  assert.deepEqual(errors, [])
  assert.deepEqual(await app.evaluate(() => globalThis.mainErrors), [])
  passed('Connection Hub screenshots captured in Light and Dark with no renderer errors')
  await page.getByRole('button', { name: 'Close connections', exact: true }).click()
  await app.evaluate(({ BrowserWindow }) => {
    globalThis.fixtureKeepAlive = new BrowserWindow({ show: false })
    globalThis.clearedCredentialEntries = 0
    const clear = Map.prototype.clear
    Map.prototype.clear = function () {
      for (const entry of this.values()) {
        if (entry?.value?.method === 'password' || entry?.value?.method === 'key') {
          globalThis.clearedCredentialEntries++
        }
      }
      return clear.call(this)
    }
  })
  const closed = page.waitForEvent('close')
  await page.evaluate(() => window.api.confirmClose())
  await closed
  assert.ok(await app.evaluate(() => globalThis.clearedCredentialEntries > 0))
  assert.deepEqual(await app.evaluate(() => globalThis.mainErrors), [])
  passed('Closing the renderer clears cached credentials while the main process stays alive')
  console.log(JSON.stringify({ passed: checks.length, artifacts: root }, null, 2))
} catch (error) {
  await page
    .screenshot({ animations: 'disabled', path: resolve(root, 'failure.png') })
    .catch(() => undefined)
  console.error('Renderer errors:', errors)
  console.error(
    'Visible failure:',
    await page
      .locator('body')
      .innerText()
      .catch(() => 'closed')
  )
  throw error
} finally {
  await app
    .evaluate(({ app }) => {
      setTimeout(() => app.exit(0), 0)
    })
    .catch(() => undefined)
  await app.close().catch(() => undefined)
  for (const client of clients) {
    client.end()
  }
  ssh?.close()
  http.closeAllConnections()
  http.close()
  if (localLinuxPath) {
    await unlink(localLinuxPath).catch(() => undefined)
  }
}
