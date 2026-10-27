import { performance } from 'node:perf_hooks'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createServer } from 'vite'

const server = await createServer({
  configFile: false,
  logLevel: 'silent',
  server: { middlewareMode: true }
})
const rows = []
function measure(name, bytes, action) {
  for (let index = 0; index < 5; index++) {
    action()
  }
  const samples = []
  for (let index = 0; index < 30; index++) {
    const start = performance.now()
    action()
    samples.push(performance.now() - start)
  }
  samples.sort((a, b) => a - b)
  const row = { name, bytes, medianMs: +samples[15].toFixed(3), p95Ms: +samples[28].toFixed(3) }
  rows.push(row)
  console.log(JSON.stringify(row))
}
try {
  const { countWords } = await server.ssrLoadModule('/src/renderer/lib/utils/markdown.ts')
  const { editBudget } = await server.ssrLoadModule('/src/renderer/lib/editBudget.ts')
  const { EditorState } = await import('@codemirror/state')
  for (const bytes of [4000, 16000, 64000, 256000]) {
    const source = '!['.repeat(bytes / 2)
    measure('malformed-word-count', bytes, () => countWords(source))
  }
  let state = EditorState.create({
    doc: `${'A normal line of text.\n'.repeat(190000)}`,
    extensions: [
      editBudget(() => {
        throw new Error('Unexpected admission rejection')
      })
    ]
  })
  const bytes = state.doc.length
  measure('bounded-edit-on-4MiB-document', bytes, () => {
    state = state.update({ changes: { from: 0, insert: 'a' } }).state
  })
  await mkdir(resolve('tmp/perf-security'), { recursive: true })
  await writeFile(
    resolve('tmp/perf-security/implementation-benchmark.json'),
    JSON.stringify(
      {
        node: process.versions.node,
        note: 'In-process warm measurements; no 10 GiB file allocated, no native startup or RSS claim.',
        rows
      },
      null,
      2
    )
  )
} finally {
  await server.close()
}
