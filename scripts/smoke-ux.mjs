import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { randomUUID, generateKeyPairSync, createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { _electron } from 'playwright'
import ssh2 from 'ssh2'

const { Server, utils } = ssh2

const root = resolve('tmp/ux-smoke')
const folder = join(root, 'files')
await mkdir(join(folder, 'Projects'), { recursive: true })
await writeFile(join(folder, 'notes.md'), '# Fixture\n\nOriginal text.')
await writeFile(join(folder, '.hidden.md'), '# Hidden')
await writeFile(join(folder, 'other.txt'), 'Other')
await writeFile(join(folder, 'Projects', 'ghi chú.md'), '# Unicode fixture')
const large = join(root, 'large.md')
await writeFile(large, `${'x'.repeat(65533)}needle\n${'x'.repeat(6 * 1024 * 1024)}`)
const profile = join(root, `profile-${Date.now()}`)
const harness = join(root, 'main.mjs')
await writeFile(
  harness,
  `import { app } from 'electron'; globalThis.mainErrors=[]; process.on('uncaughtException',e=>mainErrors.push(e.message)); process.on('unhandledRejection',e=>mainErrors.push(String(e))); app.setPath('userData',${JSON.stringify(profile)}); await import(${JSON.stringify(pathToFileURL(resolve('out/main/index.js')).href)});`
)
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE
const app = await _electron.launch({
  executablePath: createRequire(import.meta.url)('electron'),
  args: [harness],
  env,
  timeout: 30000
})
const checks = []
const passed = message => {
  checks.push(message)
  console.log(`PASS ${message}`)
}
let ssh
const clients = new Set()
let linuxRoot
const distro = process.env.MARKA_TEST_WSL_DISTRO
const exec = promisify(execFile)
const wsl = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'wsl.exe')
try {
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.locator('.tiptap').waitFor()
  await app.evaluate(({ dialog }) => {
    dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] })
    dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
  })
  await page.getByRole('button', { name: 'Open connections', exact: true }).click()
  await page.getByRole('button', { name: 'Browse files', exact: true }).click()
  await page.getByRole('dialog').waitFor()
  passed('Canceling the native picker returns to the connection hub')
  await page.getByRole('button', { name: /Network \/ Path/ }).click()
  await page.getByLabel('File path', { exact: true }).fill('C:\\fixture\\notes.md')
  await page.getByRole('button', { name: /From URL/ }).click()
  await page.getByRole('button', { name: /Network \/ Path/ }).click()
  assert.equal(
    await page.getByLabel('File path', { exact: true }).inputValue(),
    'C:\\fixture\\notes.md'
  )
  passed('Changing connection methods preserves each non-secret location draft')
  await page.getByRole('button', { name: /This computer Browse/ }).click()
  await app.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [folder] })
  }, folder)
  await page.getByRole('button', { name: 'Browse a folder', exact: true }).click()
  await page.getByRole('button', { name: 'File notes.md', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'File other.txt', exact: true }).count(), 0)
  assert.equal(await page.getByRole('button', { name: 'File .hidden.md', exact: true }).count(), 0)
  await page.getByLabel('Hidden files', { exact: true }).check()
  await page.getByRole('button', { name: 'File .hidden.md', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Folder Projects', exact: true }).click()
  await page.getByRole('button', { name: 'File ghi chú.md', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Parent folder', exact: true }).click()
  await page.getByRole('button', { name: 'File notes.md', exact: true }).waitFor()
  await page.getByRole('textbox', { name: 'Filter this folder' }).fill('notes')
  await page.getByRole('button', { name: 'File notes.md', exact: true }).waitFor()
  await page.screenshot({ path: join(root, 'browser-light.png') })
  await page.getByRole('button', { name: 'File notes.md', exact: true }).press('Enter')
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  passed(
    'Folder browser filters Markdown, supports hidden files, Unicode folders and keyboard open'
  )

  const rich = page.locator('.tiptap')
  await rich.fill('Search fixture Search fixture')
  await page.keyboard.press('Control+f')
  await page.getByRole('textbox', { name: 'Find text', exact: true }).fill('Search')
  await page.getByRole('textbox', { name: 'Replace with', exact: true }).fill('Found')
  await page.getByRole('button', { name: 'Replace all', exact: true }).click()
  assert.equal((await rich.innerText()).trim(), 'Found fixture Found fixture')
  assert.equal(await rich.isVisible(), true)
  await page.getByRole('button', { name: 'Close find', exact: true }).click()
  await page.getByRole('button', { name: 'Edit menu', exact: true }).click()
  await page.getByRole('menuitem', { name: /^Undo/ }).click()
  assert.equal((await rich.innerText()).trim(), 'Search fixture Search fixture')
  await page.getByRole('button', { name: 'Markdown', exact: true }).click()
  await page.getByRole('textbox', { name: 'Markdown source' }).waitFor()
  await page.getByRole('button', { name: 'Write', exact: true }).click()
  await page.getByRole('button', { name: 'Edit menu', exact: true }).click()
  assert.equal(
    await page.getByRole('menuitem', { name: /^Undo/ }).getAttribute('data-disabled'),
    null
  )
  await page.keyboard.press('Escape')
  passed('Find and Replace stay in Write; Undo survives search and mode roundtrip')

  await writeFile(join(folder, 'notes.md'), '# External revision')
  await page.keyboard.press('Control+s')
  await page.getByRole('dialog', { name: 'File changed outside Marka' }).waitFor()
  await page.getByRole('button', { name: 'Compare versions', exact: true }).click()
  await page.getByText('# External revision', { exact: true }).waitFor()
  assert.match(await readFile(join(folder, 'notes.md'), 'utf8'), /External revision/)
  const denial = await page.evaluate(
    async path => {
      try {
        await window.api.saveFile('unsafe overwrite', path, '# Fixture\n\nOriginal text.')
        return ''
      } catch (error) {
        return error.message
      }
    },
    join(folder, 'notes.md')
  )
  assert.match(denial, /changed|baseline|revision/)
  await page.getByRole('button', { name: 'Reload saved file…', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await rich.waitFor()
  assert.match(await rich.innerText(), /External revision/)
  passed('Conflict comparison is read-only; reload requires an explicit unsaved decision')

  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
  }, large)
  await page.keyboard.press('Control+o')
  await page.getByRole('region', { name: 'Large file viewer' }).waitFor()
  await page.keyboard.press('Control+f')
  await page.getByRole('textbox', { name: 'Find in large file' }).fill('needle')
  await page.getByRole('button', { name: 'Find text', exact: true }).click()
  await page.getByText('Match at byte 65,533', { exact: true }).waitFor()
  passed('Large file search finds a match spanning two 64 KiB ranges without full-file loading')

  const hostKey = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({
    type: 'pkcs1',
    format: 'pem'
  })
  const fingerprint = `SHA256:${createHash('sha256').update(utils.parseKey(hostKey).getPublicSSH()).digest('base64').replace(/=+$/, '')}`
  const identity = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({
    type: 'pkcs1',
    format: 'pem'
  })
  const identityFile = join(root, 'browser-fixture-key')
  await writeFile(identityFile, identity, { mode: 0o600 })
  const allowedKey = utils.parseKey(identity)
  let authentications = 0
  ssh = new Server({ hostKeys: [hostKey] }, client => {
    clients.add(client)
    client.on('close', () => clients.delete(client))
    client.on('error', () => {})
    client.on('authentication', context => {
      authentications++
      const password = context.method === 'password' && context.password === 'fixture-password'
      const key =
        context.method === 'publickey' &&
        context.key.data.equals(allowedKey.getPublicSSH()) &&
        (!context.signature ||
          allowedKey.verify(context.blob, context.signature, context.hashAlgo) === true)
      if (context.username === 'fixture' && (password || key)) context.accept()
      else context.reject()
    })
    client.on('ready', () =>
      client.on('session', accept =>
        accept().on('exec', (accept, reject, info) => {
          let output
          if (info.command === 'printf %s "$HOME"') output = '/mock'
          else if (info.command.startsWith("p='/mock';") && info.command.includes('find --'))
            output = 'd\0Projects\0f\0notes.md\0f\0other.txt\0f\0<svg onload=bad>.md\0'
          else if (info.command === "cat -- '/mock/notes.md'") output = '# Remote browser fixture'
          else {
            reject()
            return
          }
          const stream = accept()
          stream.on('error', () => {})
          stream.exit(0)
          stream.end(output)
        })
      )
    )
  })
  await new Promise(resolve => ssh.listen(0, '127.0.0.1', resolve))
  const target = {
    kind: 'ssh',
    host: '127.0.0.1',
    username: 'fixture',
    port: ssh.address().port,
    path: '/',
    fingerprint
  }
  const mismatch = await page.evaluate(
    async target => {
      try {
        await window.api.startBrowser(target, { method: 'password', password: 'fixture-password' })
        return ''
      } catch (error) {
        return error.message
      }
    },
    { ...target, fingerprint: `SHA256:${'A'.repeat(43)}` }
  )
  assert.match(mismatch, /verification/i)
  assert.equal(authentications, 0)
  passed('Remote browsing rejects an untrusted SSH host before authentication')
  await page.getByRole('button', { name: 'Open connections', exact: true }).click()
  await page.getByRole('button', { name: /SSH Remote/ }).click()
  await page.getByLabel('Host', { exact: true }).fill(target.host)
  await page.getByLabel('Username', { exact: true }).fill(target.username)
  await page.getByLabel('Port', { exact: true }).fill(String(target.port))
  await page.getByLabel('Password', { exact: true }).fill('fixture-password')
  await page.getByLabel('Server fingerprint', { exact: true }).fill(fingerprint)
  await page.getByRole('button', { name: 'Connect and browse', exact: true }).click()
  await page.getByRole('button', { name: 'File notes.md', exact: true }).waitFor()
  await page.getByRole('button', { name: 'File <svg onload=bad>.md', exact: true }).waitFor()
  assert.equal(await page.locator('svg[onload]').count(), 0)
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(800, 600))
  await page.screenshot({ path: join(root, 'ssh-browser-800.png') })
  const close = await page
    .getByRole('button', { name: 'Close connections', exact: true })
    .boundingBox()
  assert.ok(close && close.y >= 0 && close.y < 600)
  await page.getByRole('button', { name: 'File notes.md', exact: true }).press('Enter')
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  await page.waitForFunction(() =>
    document.querySelector('main')?.textContent?.includes('Remote browser fixture')
  )
  assert.match(await page.getByRole('main').innerText(), /Remote browser fixture/)
  passed(
    'SSH connects without a file path and browses authenticated folders at custom port; filenames render as text'
  )

  const unselected = await page.evaluate(
    async ({ target, keyPath }) => {
      try {
        await window.api.startBrowser(target, { method: 'key', keyPath })
        return ''
      } catch (error) {
        return error.message
      }
    },
    { target, keyPath: identityFile }
  )
  assert.match(unselected, /file picker/)
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
  }, identityFile)
  await page.evaluate(() => window.api.chooseConnectionKey())
  const keySession = await page.evaluate(
    ({ target, keyPath }) => window.api.startBrowser(target, { method: 'key', keyPath }),
    { target, keyPath: identityFile }
  )
  assert.ok(keySession)
  const listing = await page.evaluate(
    id =>
      window.api.listFolder(id, {
        path: '/mock',
        filter: '',
        hidden: false,
        markdownOnly: true,
        offset: 0
      }),
    keySession.id
  )
  assert.equal(
    listing.entries.some(entry => entry.name === 'notes.md'),
    true
  )
  await page.evaluate(id => window.api.closeBrowser(id), keySession.id)
  const closed = await page.evaluate(async id => {
    try {
      await window.api.listFolder(id, {
        path: '/mock',
        filter: '',
        hidden: false,
        markdownOnly: true,
        offset: 0
      })
      return ''
    } catch (error) {
      return error.message
    }
  }, keySession.id)
  assert.match(closed, /expired/)
  passed(
    'Browser key authentication requires explicit fixture selection; closing revokes listing access'
  )

  if (distro) {
    linuxRoot = `/tmp/marka-ux-${randomUUID()}`
    await exec(wsl, ['-d', distro, '--exec', 'mkdir', '-p', linuxRoot], {
      timeout: 15000,
      windowsHide: true
    })
    const unc = `\\\\wsl.localhost\\${distro}${linuxRoot.replaceAll('/', '\\')}`
    await writeFile(join(unc, 'fixture.md'), '# WSL browser fixture')
    await writeFile(join(unc, 'other.txt'), 'text')
    const session = await page.evaluate(
      distribution => window.api.startBrowser({ kind: 'wsl', distribution }),
      distro
    )
    assert.ok(session)
    const result = await page.evaluate(
      async ({ id, path }) => {
        const listing = await window.api.listFolder(id, {
          path,
          filter: '',
          hidden: false,
          markdownOnly: true,
          offset: 0
        })
        const file = listing.entries.find(entry => entry.name === 'fixture.md')
        return { listing, document: await window.api.openBrowserFile(id, file.path) }
      },
      { id: session.id, path: unc }
    )
    assert.equal(result.listing.entries.length, 1)
    assert.equal(result.document.content, '# WSL browser fixture')
    await page.reload()
    await page.getByRole('button', { name: 'Open connections', exact: true }).waitFor()
    const expired = await page.evaluate(async id => {
      try {
        await window.api.listFolder(id, {
          path: '/',
          filter: '',
          hidden: false,
          markdownOnly: true,
          offset: 0
        })
        return ''
      } catch (error) {
        return error.message
      }
    }, session.id)
    assert.match(expired, /expired/)
    passed(
      'Real WSL browses and opens generated /tmp fixtures; reload revokes the browser capability'
    )
  }
  await page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const request = indexedDB.open('marka-recovery-v2', 2)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(['drafts', 'metadata'], 'readwrite')
      for (const suffix of ['a', 'b']) {
        const id = `ux-recovery-${suffix}`
        const filePath = `/fixture/${suffix}/same.md`
        transaction
          .objectStore('drafts')
          .put({ content: `# Recovery fixture ${suffix}`, savedContent: '# Saved', filePath }, id)
        transaction
          .objectStore('metadata')
          .put({ id, name: 'same.md', location: filePath, updatedAt: Date.now() })
      }
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
  })
  await page.reload()
  const recovery = page.getByRole('dialog', { name: 'Recover drafts' })
  await recovery.waitFor()
  const firstDraft = recovery.locator('[title="/fixture/a/same.md"]').locator('..').locator('..')
  await firstDraft.getByRole('button', { name: 'Preview', exact: true }).click()
  await page
    .getByLabel('Draft preview', { exact: true })
    .filter({ hasText: 'Recovery fixture a' })
    .waitFor()
  await firstDraft.getByRole('button', { name: 'Discard', exact: true }).click()
  await firstDraft.getByRole('button', { name: 'Confirm discard', exact: true }).waitFor()
  await page.getByRole('button', { name: 'Cancel discard', exact: true }).click()
  await firstDraft.getByRole('button', { name: 'Discard', exact: true }).click()
  await firstDraft.getByRole('button', { name: 'Confirm discard', exact: true }).click()
  await recovery.locator('[title="/fixture/a/same.md"]').waitFor({ state: 'hidden' })
  await recovery.locator('[title="/fixture/b/same.md"]').waitFor()
  await recovery.getByRole('button', { name: 'Restore', exact: true }).click()
  await recovery.waitFor({ state: 'hidden' })
  await page.getByText(/^Recovered your unsaved draft\./).waitFor()
  await page.waitForFunction(() =>
    document.querySelector('main')?.textContent?.includes('Recovery fixture b')
  )
  passed(
    'Recovery distinguishes same-name drafts by location, previews safely and confirms discard before restore'
  )
  assert.deepEqual(errors, [])
  assert.deepEqual(await app.evaluate(() => globalThis.mainErrors), [])
  await writeFile(join(root, 'checks.json'), JSON.stringify(checks, null, 2))
  console.log(`${checks.length} UX checks passed`)
} finally {
  for (const client of clients) client.destroy()
  if (ssh) await new Promise(resolve => ssh.close(resolve))
  await app
    .evaluate(({ app }) => {
      setTimeout(() => app.exit(0), 0)
    })
    .catch(() => {})
  await app.close().catch(() => {})
  if (linuxRoot && distro)
    await exec(wsl, ['-d', distro, '--exec', 'rmdir', linuxRoot], {
      timeout: 15000,
      windowsHide: true
    }).catch(async () => {
      for (const name of ['fixture.md', 'other.txt'])
        await exec(wsl, ['-d', distro, '--exec', 'rm', '--', `${linuxRoot}/${name}`], {
          timeout: 15000,
          windowsHide: true
        })
      await exec(wsl, ['-d', distro, '--exec', 'rmdir', linuxRoot], {
        timeout: 15000,
        windowsHide: true
      })
    })
}
