import { parseDraft, type Draft } from './draft'

export interface RecoveryChoice {
  id: string
  name: string
  updatedAt: number
}

let database: Promise<IDBDatabase> | null = null
let session: string | null = null
let pending: Draft | null | undefined
let writing: Promise<void> | null = null
let flushCallback: (() => Promise<void>) | null = null

export function recoverySession(): string {
  if (!session) {
    try {
      session = sessionStorage.getItem('marka-session')
    } catch {
      session = null
    }
    session ??= crypto.randomUUID()
    try {
      sessionStorage.setItem('marka-session', session)
    } catch {}
  }
  return session
}

function openDatabase(): Promise<IDBDatabase> {
  database ??= new Promise((resolve, reject) => {
    let finished = false
    const fail = (): void => {
      if (finished) {
        return
      }
      finished = true
      clearTimeout(timer)
      database = null
      reject(new Error('Recovery storage unavailable. Save your document.'))
    }
    const timer = setTimeout(fail, 5000)
    const request = indexedDB.open('marka-recovery-v2', 2)
    request.onupgradeneeded = (): void => {
      if (!request.result.objectStoreNames.contains('drafts')) {
        request.result.createObjectStore('drafts')
      }
      const store = request.result.objectStoreNames.contains('metadata')
        ? request.transaction?.objectStore('metadata')
        : request.result.createObjectStore('metadata', { keyPath: 'id' })
      if (store && !store.indexNames.contains('updatedAt')) {
        store.createIndex('updatedAt', 'updatedAt')
      }
    }
    request.onerror = fail
    request.onblocked = fail
    request.onsuccess = (): void => {
      if (finished) {
        request.result.close()
        return
      }
      finished = true
      clearTimeout(timer)
      request.result.onversionchange = (): void => {
        request.result.close()
        database = null
      }
      resolve(request.result)
    }
  })
  return database
}

export async function recoveryChoices(): Promise<RecoveryChoice[]> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const choices: RecoveryChoice[] = []
    const request = db
      .transaction('metadata')
      .objectStore('metadata')
      .index('updatedAt')
      .openCursor(null, 'prev')
    request.onsuccess = (): void => {
      const cursor = request.result
      if (cursor && choices.length < 32) {
        const value: unknown = cursor.value
        if (
          value &&
          typeof value === 'object' &&
          'id' in value &&
          typeof value.id === 'string' &&
          'name' in value &&
          typeof value.name === 'string' &&
          'updatedAt' in value &&
          typeof value.updatedAt === 'number'
        ) {
          choices.push({
            id: value.id,
            name: value.name.slice(0, 256),
            updatedAt: value.updatedAt
          })
        }
        cursor.continue()
        return
      }
      resolve(choices)
    }
    request.onerror = (): void => reject(request.error)
  })
}

export async function loadRecovery(id = recoverySession()): Promise<Draft | null> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const request = db.transaction('drafts').objectStore('drafts').get(id)
    request.onsuccess = (): void => resolve(parseDraft(request.result))
    request.onerror = (): void => reject(request.error)
  })
}

async function writeRecord(id: string, draft: Draft | null): Promise<void> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['drafts', 'metadata'], 'readwrite')
    if (draft) {
      const valid = parseDraft(draft)
      if (!valid) {
        reject(new Error('Draft exceeds the recovery budget. Save your document.'))
        transaction.abort()
        return
      }
      const metadata = transaction.objectStore('metadata')
      const count = metadata.count()
      count.onsuccess = (): void => {
        const existing = metadata.get(id)
        existing.onsuccess = (): void => {
          if (count.result >= 32 && !existing.result) {
            reject(
              new Error(
                'Recovery storage holds 32 drafts. Restore or discard older drafts before continuing.'
              )
            )
            transaction.abort()
            return
          }
          transaction.objectStore('drafts').put(valid, id)
          metadata.put({
            id,
            name: valid.filePath?.split(/[\\/]/).pop() ?? 'Untitled.md',
            updatedAt: Date.now()
          })
        }
      }
    } else {
      transaction.objectStore('drafts').delete(id)
      transaction.objectStore('metadata').delete(id)
    }
    transaction.oncomplete = (): void => resolve()
    transaction.onerror = (): void =>
      reject(new Error('Draft recovery could not be written. Save your document.'))
    transaction.onabort = (): void =>
      reject(new Error('Draft recovery was interrupted. Save your document.'))
  })
}

export async function discardRecovery(id: string): Promise<void> {
  await writeRecord(id, null)
}

export function saveRecovery(draft: Draft | null): Promise<void> {
  pending = draft
  if (!writing) {
    writing = (async () => {
      while (pending !== undefined) {
        const value = pending
        pending = undefined
        await writeRecord(recoverySession(), value)
      }
    })().finally(() => {
      writing = null
    })
  }
  return writing
}

export function registerRecoveryFlush(callback: () => Promise<void>): () => void {
  flushCallback = callback
  return () => {
    if (flushCallback === callback) {
      flushCallback = null
    }
  }
}

export async function flushRecovery(): Promise<void> {
  await flushCallback?.()
}
