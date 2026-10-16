import { after, test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseTarget, targetLabel, wslPath } from '../src/shared/connections'
import { quoteRemotePath, sshConfig, sshSaveCommand } from '../src/main/connections/ssh'
import { runProcess } from '../src/main/connections/process'
import { decodeDocument } from '../src/main/connections/document'
import { openConnectedDocument, readUrl } from '../src/main/connections'

const server = createServer((request, response) => {
  if (request.url === '/redirect') {
    response.writeHead(302, { location: '/notes.md' })
    response.end()
    return
  }
  if (request.url === '/bad-redirect') {
    response.writeHead(302, { location: 'file:///etc/passwd' })
    response.end()
    return
  }
  if (request.url === '/html') {
    response.writeHead(200, { 'content-type': 'text/html' })
    response.end('<h1>Page</h1>')
    return
  }
  if (request.url === '/binary') {
    response.end(Buffer.from([0, 255, 0]))
    return
  }
  if (request.url === '/large') {
    response.end('x'.repeat(5 * 1024 * 1024 + 1))
    return
  }
  if (request.url === '/404') {
    response.writeHead(404)
    response.end()
    return
  }
  response.writeHead(200, { 'content-type': 'text/markdown' })
  response.end('# Imported\n\nHello world.')
})
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
if (!address || typeof address === 'string') {
  throw new Error('HTTP fixture failed to start')
}
const base = `http://127.0.0.1:${address.port}`
after(() => {
  server.closeAllConnections()
  server.close()
})

test('validates SSH endpoints and rejects options, credentials and control characters', () => {
  assert.deepEqual(parseTarget({ kind: 'ssh', host: 'dev-alias', path: '~/notes.md' }), {
    kind: 'ssh',
    host: 'dev-alias',
    path: '~/notes.md'
  })
  for (const patch of [
    { host: '-oProxyCommand=bad' },
    { host: 'user@host' },
    { host: 'host;bad' },
    { username: 'me\nroot' },
    { port: 0 },
    { port: 65536 },
    { path: 'relative.md' },
    { path: '/tmp/x\0' }
  ]) {
    assert.throws(() => parseTarget({ kind: 'ssh', host: 'dev', path: '/notes.md', ...patch }))
  }
})

test('URL targets reject embedded credentials and non-HTTP protocols', () => {
  for (const url of ['file:///etc/passwd', 'ssh://host/file', 'https://me:secret@host/notes.md']) {
    assert.throws(() => parseTarget({ kind: 'url', url }))
  }
})

test('WSL maps Linux paths without allowing share traversal or Windows stream syntax', () => {
  assert.equal(
    wslPath('Ubuntu-24.04', '/home/me/notes.md'),
    '\\\\wsl.localhost\\Ubuntu-24.04\\home\\me\\notes.md'
  )
  for (const [distribution, path] of [
    ['../Other', '/notes.md'],
    ['Ubuntu', '/../other'],
    ['Ubuntu', '/notes:stream'],
    ['Ubuntu', '~/.notes']
  ]) {
    assert.throws(() => wslPath(distribution, path))
  }
})

test('remote paths remain shell literals, including quotes and substitutions', () => {
  assert.equal(
    quoteRemotePath("/home/me/a'b $(touch bad).md"),
    "'/home/me/a'\\''b $(touch bad).md'"
  )
  assert.equal(quoteRemotePath('~/with space.md'), '"$HOME"/\'with space.md\'')
})

test('SSH password config pins trust and never configures machine keys or agents', async () => {
  const target = {
    kind: 'ssh' as const,
    host: 'dev',
    path: '/notes.md',
    username: 'me',
    port: 2222,
    fingerprint: `SHA256:${'a'.repeat(43)}`
  }
  const config = await sshConfig(target, { method: 'password', password: 'fixture-secret' })
  assert.equal(config.port, 2222)
  assert.equal(config.password, 'fixture-secret')
  assert.deepEqual(config.authHandler, ['password'])
  assert.equal(config.agent, undefined)
  assert.equal(config.privateKey, undefined)
  assert.equal(config.tryKeyboard, undefined)
  assert.equal(targetLabel(target), 'ssh://me@dev:2222/notes.md')
  await assert.rejects(sshConfig(target), /password or explicitly/)
  await assert.rejects(
    sshConfig({ ...target, fingerprint: undefined }, { method: 'password', password: 'x' }),
    /fingerprint/
  )
})

test('remote writes check both before and after upload, stage atomically and preserve attributes', () => {
  const command = sshSaveCommand({ kind: 'ssh', host: 'dev', path: '/notes.md' }, 'Original')
  assert.equal(command.split('sha256sum').length - 1, 2)
  assert.match(command, /mktemp/)
  assert.match(command, /cat > "\$t"/)
  assert.match(command, /--preserve=mode,ownership/)
  assert.match(command, /mv -f -- "\$t" "\$p"/)
  assert.doesNotMatch(command, /cat > "\$p"/)
})

test('text decoding preserves BOM bytes for remote conflict checks and rejects binary input', () => {
  assert.equal(decodeDocument(Buffer.from('\uFEFF# Hello')), '\uFEFF# Hello')
  assert.throws(() => decodeDocument(Buffer.from([255, 254])))
  assert.throws(() => decodeDocument(Buffer.from('a\0b')))
})

test('URL imports follow safe redirects and return a writable local copy', async () => {
  const result = await openConnectedDocument({ kind: 'url', url: `${base}/redirect` })
  assert.match(result.content, /# Imported/)
  assert.equal(result.location, null)
  assert.equal(result.path, null)
})

test('URL imports reject HTML pages, binary content, unsafe redirects and oversized responses', async () => {
  for (const path of ['/html', '/binary', '/bad-redirect', '/large', '/404']) {
    await assert.rejects(readUrl(`${base}${path}`))
  }
})

test('URL imports can be cancelled', async () => {
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(readUrl(`${base}/notes.md`, controller.signal))
})

test('local connection reads a real file without interpreting its path as a command', async () => {
  const directory = resolve('tmp/connection-tests')
  await mkdir(directory, { recursive: true })
  const path = resolve(directory, 'notes with space.md')
  await writeFile(path, '# Local')
  try {
    assert.equal((await openConnectedDocument({ kind: 'local', path })).content, '# Local')
  } finally {
    await unlink(path)
  }
})

test('process transport preserves argument boundaries and enforces output bounds', async () => {
  const text = 'a; $(echo no) "quoted"'
  const result = await runProcess(process.execPath, [
    '-e',
    'process.stdout.write(process.argv[1])',
    text
  ])
  assert.equal(result.toString(), text)
  await assert.rejects(
    runProcess(process.execPath, ['-e', 'process.stdout.write("x".repeat(100))'], { maxBytes: 20 }),
    /limit/
  )
})

test('process transport terminates timed-out and cancelled connections', async () => {
  await assert.rejects(
    runProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { timeoutMs: 100 }),
    /timed out/
  )
  const controller = new AbortController()
  const pending = runProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    signal: controller.signal
  })
  controller.abort()
  await assert.rejects(pending, /cancelled/)
})
