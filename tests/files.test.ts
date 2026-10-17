import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, readdir, rm, unlink, link, rename } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  FileAccess,
  atomicWrite,
  readEditable,
  readRevision,
  readTextRange,
  decodeText
} from '../src/main/files'
import {
  editableBytes,
  pageBytes,
  maximumViewerBytes,
  checkedContent
} from '../src/shared/documents'
import { createLatestTask } from '../src/renderer/lib/latestTask'
import { EditorState } from '@codemirror/state'
import { editBudget } from '../src/renderer/lib/editBudget'
import { createCheckpoint } from '../src/renderer/lib/checkpoint'
import { runProcess } from '../src/main/connections/process'

async function fixture(action: (directory: string, path: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'marka-files-'))
  const path = join(directory, 'notes.md')
  try {
    await action(directory, path)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('local decoder rejects binary and invalid UTF-8 without replacement', () => {
  assert.throws(() => decodeText(Buffer.from([0xff, 0xfe])), /UTF-8/)
  assert.throws(() => decodeText(Buffer.from('a\0b')), /Binary/)
  assert.equal(decodeText(Buffer.from('\uFEFFĐúng UTF-8')), '\uFEFFĐúng UTF-8')
})

test('every editable payload applies a byte budget including multibyte text', () => {
  assert.throws(() => checkedContent('🙂'.repeat(10), 30), /budget/)
  assert.throws(() => checkedContent({ content: 'bad shape' }), /budget/)
  assert.throws(() => checkedContent('a\0b'), /binary/)
  assert.throws(() => checkedContent('\uD800'), /budget|binary/)
})

test('source rejects edits beyond the UTF-8 byte budget before changing the buffer', () => {
  let rejected = 0
  const state = EditorState.create({
    doc: 'a'.repeat(editableBytes - 2),
    extensions: [
      editBudget(() => {
        rejected++
      })
    ]
  })
  const rejectedEdit = state.update({ changes: { from: state.doc.length, insert: '🙂' } })
  assert.equal(rejectedEdit.docChanged, false)
  assert.equal(rejected, 1)
  const accepted = state.update({ changes: { from: state.doc.length, insert: 'é' } })
  assert.equal(accepted.docChanged, true)
  assert.equal(accepted.state.update({ changes: { from: 0, to: 1, insert: 'a' } }).docChanged, true)
  assert.equal(state.update({ changes: { from: 0, insert: '\0' } }).docChanged, false)
})

test('edits cannot split surrogate pairs or bypass the UTF-8 byte budget', () => {
  const state = EditorState.create({ doc: '🙂', extensions: [editBudget(() => undefined)] })
  assert.equal(state.update({ changes: { from: 0, to: 1, insert: '' } }).docChanged, false)
  assert.equal(state.update({ changes: { from: 1, insert: 'a' } }).docChanged, false)
  assert.equal(state.update({ changes: { from: 2, insert: '\uD800' } }).docChanged, false)
  assert.equal(state.update({ changes: { from: 0, to: 2, insert: 'é' } }).state.doc.toString(), 'é')
})

test('continuous edits trigger a checkpoint by the maximum wait', context => {
  context.mock.timers.enable({ apis: ['setTimeout'] })
  let writes = 0
  const checkpoint = createCheckpoint(() => {
    writes++
  })
  for (let step = 0; step < 20; step++) {
    checkpoint.schedule()
    context.mock.timers.tick(500)
  }
  assert.equal(writes, 2)
  checkpoint.reset()
})

test('export refuses a destination changed during rendering', async () =>
  fixture(async (_directory, path) => {
    await writeFile(path, 'original export')
    const access = new FileAccess()
    const revision = await access.prepareSaveAs(path)
    await writeFile(path, 'another application output')
    await assert.rejects(
      () => access.saveAs(path, Buffer.from('new export'), revision),
      /changed on disk/
    )
    assert.equal(await readFile(path, 'utf8'), 'another application output')
  }))

test(
  'Windows Save retains protected owner-only access controls',
  { skip: process.platform !== 'win32' },
  async () =>
    fixture(async (_directory, path) => {
      await writeFile(path, 'restricted original')
      const script = `$ErrorActionPreference='Stop'; $env:PSModulePath=[IO.Path]::Combine($PSHOME,'Modules'); $p=[Console]::In.ReadToEnd()|ConvertFrom-Json; if($p.restrict){$acl=[Security.AccessControl.FileSecurity]::new();$acl.SetAccessRuleProtection($true,$false);$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.WindowsIdentity]::GetCurrent().User,[Security.AccessControl.FileSystemRights]::FullControl,[Security.AccessControl.AccessControlType]::Allow));Set-Acl -LiteralPath $p.path -AclObject $acl}; (Get-Acl -LiteralPath $p.path).Sddl`
      const inspect = async (restrict: boolean): Promise<string> =>
        (
          await runProcess(
            join(
              process.env.SystemRoot ?? 'C:\\Windows',
              'System32',
              'WindowsPowerShell',
              'v1.0',
              'powershell.exe'
            ),
            [
              '-NoProfile',
              '-NonInteractive',
              '-EncodedCommand',
              Buffer.from(script, 'utf16le').toString('base64')
            ],
            { input: JSON.stringify({ path, restrict }), maxBytes: 4096 }
          )
        )
          .toString()
          .trim()
      const original = await inspect(true)
      const access = new FileAccess()
      await access.open(path)
      await access.save(path, 'restricted replacement', 'restricted original')
      assert.equal(await inspect(false), original)
      assert.equal(await readFile(path, 'utf8'), 'restricted replacement')
    })
)

test('worker creation failure is reported without escaping the scheduler', async () => {
  let failures = 0
  const task = createLatestTask(
    async () => {
      throw new Error('Worker unavailable')
    },
    () => {},
    () => {
      failures++
    }
  )
  task.submit(1)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(failures, 1)
  task.dispose()
})

test('navigation revokes pending reads and precommit write authorization', async () =>
  fixture(async (_directory, path) => {
    await writeFile(path, 'original')
    const access = new FileAccess()
    const opening = access.open(path)
    const rejected = assert.rejects(opening, /expired|changed/)
    await access.dispose()
    await rejected
    let checks = 0
    const awaitRevision = await readRevision(path)
    await assert.rejects(
      () =>
        atomicWrite(path, Buffer.from('late edit'), awaitRevision, rename, () => {
          if (++checks === 2) {
            throw new Error('Expired request')
          }
        }),
      /Expired request/
    )
    assert.equal(await readFile(path, 'utf8'), 'original')
  }))

test('an external postcommit write is not accepted as the next saved baseline', async () =>
  fixture(async (_directory, path) => {
    await writeFile(path, 'original')
    const original = await readRevision(path)
    const committed = await atomicWrite(
      path,
      Buffer.from('our edit'),
      original,
      async (from, to) => {
        await rename(from, to)
        await writeFile(path, 'external edit after commit')
      }
    )
    await assert.rejects(
      () => atomicWrite(path, Buffer.from('second edit'), committed),
      /changed on disk/
    )
    assert.equal(await readFile(path, 'utf8'), 'external edit after commit')
  }))

test('Save As file grants remain bounded across repeated destinations', async () =>
  fixture(async (directory, _path) => {
    const access = new FileAccess()
    const paths = Array.from({ length: 5 }, (_value, index) => join(directory, `${index}.md`))
    for (const path of paths) {
      await access.saveAsText(path, 'saved copy')
    }
    await assert.rejects(
      () => access.save(paths[0] ?? '', 'ungranted overwrite', 'saved copy'),
      /expired/
    )
    await access.save(paths[4] ?? '', 'newest update', 'saved copy')
    assert.equal(await readFile(paths[4] ?? '', 'utf8'), 'newest update')
    await access.dispose()
  }))

test('large local files are paged rather than returned as a full string', async () =>
  fixture(async (_directory, path) => {
    await writeFile(path, 'a'.repeat(editableBytes + 1))
    const access = new FileAccess()
    try {
      const result = await access.open(path)
      assert.equal(result.content, '')
      assert.equal(result.paged?.size, editableBytes + 1)
      assert.ok(result.paged)
      const page = await access.page(result.paged.handle, 0)
      assert.equal(page.text.length, pageBytes)
      assert.equal(page.nextOffset, pageBytes)
      await assert.rejects(() => readEditable(path), /5 MiB/)
      await assert.rejects(() => new FileAccess().page(result.paged!.handle, 0), /expired/)
    } finally {
      await access.dispose()
    }
  }))

test('short range reads reassemble UTF-8 characters and always progress', async () => {
  const source = Buffer.from('🙂é')
  let reads = 0
  const page = await readTextRange(source.length, 0, async (bytes, offset) => {
    reads++
    bytes[0] = source[offset] ?? 0
    return 1
  })
  assert.equal(page.text, '🙂é')
  assert.equal(page.nextOffset, source.length)
  assert.equal(reads, source.length)
})

test('10 GiB range metadata needs only a bounded allocation and read', async () => {
  let allocated = 0
  const result = await readTextRange(maximumViewerBytes, maximumViewerBytes - 123, async bytes => {
    allocated = bytes.length
    bytes.fill(0x61)
    return bytes.length
  })
  assert.equal(allocated, 123)
  assert.equal(result.text, 'a'.repeat(123))
  assert.equal(result.nextOffset, maximumViewerBytes)
  await assert.rejects(() => readTextRange(maximumViewerBytes + 1, 0, async () => 0), /Invalid/)
  await assert.rejects(() => readTextRange(100, -1, async () => 0), /Invalid/)
})

test('UTF-8 characters at the page edge survive successive range reads', async () => {
  const source = Buffer.from('a'.repeat(pageBytes - 2) + '🙂Tiếng Việt')
  const read = async (bytes: Buffer, offset: number): Promise<number> =>
    source.copy(bytes, 0, offset, offset + bytes.length)
  const first = await readTextRange(source.length, 0, read)
  const second = await readTextRange(source.length, first.nextOffset, read)
  assert.equal(first.text + second.text, source.toString('utf8'))
  assert.equal(first.nextOffset, pageBytes - 2)
})

test('page reads detect an externally modified file and expired handles', async () =>
  fixture(async (_directory, path) => {
    await writeFile(path, 'a'.repeat(editableBytes + 1))
    const access = new FileAccess()
    const result = await access.open(path)
    assert.ok(result.paged)
    await writeFile(path, 'changed')
    await assert.rejects(() => access.page(result.paged!.handle, 0), /changed/)
    await access.closeReader(result.paged.handle)
    await assert.rejects(() => access.page(result.paged!.handle, 0), /expired/)
  }))

test('local writers with the same baseline cannot silently overwrite each other', async () =>
  fixture(async (_directory, path) => {
    await writeFile(path, 'Original')
    const first = new FileAccess(),
      second = new FileAccess()
    await first.open(path)
    await second.open(path)
    await first.save(path, 'First writer', 'Original')
    await assert.rejects(() => second.save(path, 'Stale writer', 'Original'), /changed on disk/)
    assert.equal(await readFile(path, 'utf8'), 'First writer')
  }))

test('parallel atomic saves serialize revision checks', async () =>
  fixture(async (_directory, path) => {
    await writeFile(path, 'Original')
    const revision = (await readEditable(path)).revision
    const results = await Promise.allSettled([
      atomicWrite(path, Buffer.from('One'), revision),
      atomicWrite(path, Buffer.from('Two'), revision)
    ])
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
    assert.equal(results.filter(result => result.status === 'rejected').length, 1)
  }))

test('replacement failure keeps original bytes and removes staging files', async () =>
  fixture(async (directory, path) => {
    await writeFile(path, 'Original')
    const revision = (await readEditable(path)).revision
    await assert.rejects(
      () =>
        atomicWrite(path, Buffer.from('New'), revision, async () => {
          throw new Error('Injected replacement failure')
        }),
      /Injected/
    )
    assert.equal(await readFile(path, 'utf8'), 'Original')
    assert.deepEqual(await readdir(directory), ['notes.md'])
  }))

test('save refuses unopened paths deleted files and hardlink replacement', async () =>
  fixture(async (directory, path) => {
    const access = new FileAccess()
    await writeFile(path, 'Original')
    await assert.rejects(() => access.save(path, 'New'), /expired/)
    await access.open(path)
    await link(path, join(directory, 'alias.md'))
    await assert.rejects(() => access.save(path, 'New', 'Original'), /hard links/)
    await unlink(join(directory, 'alias.md'))
    await unlink(path)
    await assert.rejects(() => access.save(path, 'New', 'Original'))
  }))

test('local save preserves UTF-8 BOM and uniform CRLF across edits', async () =>
  fixture(async (_directory, path) => {
    await writeFile(path, '\uFEFFOne\r\nTwo\r\n')
    const access = new FileAccess()
    const original = await access.open(path)
    await access.save(path, 'One\nChanged\n', original.content)
    assert.equal(await readFile(path, 'utf8'), '\uFEFFOne\r\nChanged\r\n')
    await access.save(path, 'One\nAgain\n', 'One\nChanged\n')
    assert.equal(await readFile(path, 'utf8'), '\uFEFFOne\r\nAgain\r\n')
  }))

test('latest task queue drops intermediate jobs and stale responses', async () => {
  const completions: Array<(value: number) => void> = []
  const started: number[] = [],
    received: number[] = []
  const queue = createLatestTask<number, number>(
    value => {
      started.push(value)
      return new Promise(resolve => completions.push(resolve))
    },
    value => received.push(value),
    () => assert.fail('Unexpected failure')
  )
  queue.submit(1)
  queue.submit(2)
  queue.submit(3)
  assert.deepEqual(started, [1])
  completions[0]!(1)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(started, [1, 3])
  completions[1]!(3)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.deepEqual(received, [3])
  queue.dispose()
})

test('worker deadline aborts hung work and disposal prevents late delivery', async () => {
  let aborted = false,
    failures = 0
  const queue = createLatestTask<number, number>(
    (_value, signal) =>
      new Promise(() => {
        signal.addEventListener('abort', () => {
          aborted = true
        })
      }),
    () => assert.fail('Late delivery'),
    () => {
      failures++
    },
    10
  )
  queue.submit(1)
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal(aborted, true)
  assert.equal(failures, 1)
  queue.dispose()
})
