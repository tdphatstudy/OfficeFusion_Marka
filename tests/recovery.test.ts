import { test } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import {
  recoveryChoices,
  loadRecovery,
  saveRecovery,
  discardRecovery,
  recoverySession
} from '../src/renderer/lib/recovery'
import { safePreferences } from '../src/renderer/lib/preferences'

const draft = { content: 'unsaved draft', savedContent: 'original', filePath: null }

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('marka-recovery-v2')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

test('recovery isolates sessions, lists newest metadata and applies bounded retention', async () => {
  await saveRecovery(draft)
  assert.deepEqual(await loadRecovery(), draft)
  const db = await database()
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(['drafts', 'metadata'], 'readwrite')
    for (let i = 0; i < 40; i++) {
      const id = `legacy-${String(i).padStart(2, '0')}`
      transaction.objectStore('drafts').put({ ...draft, content: `draft ${i}` }, id)
      transaction
        .objectStore('metadata')
        .put({ id, name: `${i}.md`, updatedAt: Date.now() + i + 1000 })
    }
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
  assert.equal((await recoveryChoices())[0]?.id, 'legacy-39')
  assert.equal((await recoveryChoices()).length, 32)
  await saveRecovery(null)
  assert.equal(await loadRecovery(), null)
  assert.equal((await loadRecovery('legacy-39'))?.content, 'draft 39')
  await assert.rejects(() => saveRecovery(draft), /32 drafts/)
  for (let i = 0; i < 10; i++) {
    await discardRecovery(`legacy-${String(i).padStart(2, '0')}`)
  }
  await saveRecovery(draft)
  assert.equal((await loadRecovery())?.content, 'unsaved draft')
  await saveRecovery({ ...draft, content: 'newest owned edit' })
  assert.equal((await loadRecovery(recoverySession()))?.content, 'newest owned edit')
  db.close()
})

test('storage quota failure retains the previous committed checkpoint', async () => {
  const original = IDBObjectStore.prototype.put
  IDBObjectStore.prototype.put = () => {
    throw new DOMException('fixture quota', 'QuotaExceededError')
  }
  try {
    await assert.rejects(
      () => saveRecovery({ ...draft, content: 'not committed' }),
      /interrupted|quota/
    )
  } finally {
    IDBObjectStore.prototype.put = original
  }
  assert.equal((await loadRecovery())?.content, 'newest owned edit')
  await saveRecovery({ ...draft, content: 'storage recovered' })
  assert.equal((await loadRecovery())?.content, 'storage recovered')
})

test('persisted preferences cannot overwrite content, actions or unsafe numeric values', () => {
  const value = safePreferences(
    'marka-editor',
    JSON.stringify({
      state: {
        setContent: null,
        content: 'injected',
        viewMode: 'malformed',
        config: { tabSize: 1e99, fontSize: -30, fontFamily: '__proto__' }
      }
    })
  )
  assert.ok(value)
  const parsed = JSON.parse(value)
  assert.equal(parsed.state.content, undefined)
  assert.equal(parsed.state.setContent, undefined)
  assert.equal(parsed.state.config.tabSize, 8)
  assert.equal(parsed.state.config.fontSize, 12)
  assert.equal(parsed.state.config.fontFamily, 'sans')
  assert.equal(safePreferences('marka-ui', '{broken'), null)
  assert.equal(safePreferences('marka-ui', 'x'.repeat(300_000)), null)
})
