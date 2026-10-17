import { BrowserWindow, session } from 'electron'
import { parseDraft, draftKey } from '../shared/draft'
import { safePreferences } from '../shared/preferences'
import { editableBytes } from '../shared/documents'

export const inertMigrationHtml =
  '<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'none\'"><title>Storage migration</title>'
const marker = 'marka-origin-migration-v1'

export async function migrateLegacyStorage(legacyURL: string): Promise<void> {
  const window = new BrowserWindow({
    show: false,
    webPreferences: {
      session: session.defaultSession,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      javascript: false
    }
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  window.webContents.on('will-frame-navigate', event => event.preventDefault())
  let intercepted = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const debuggerApi = window.webContents.debugger
  const storageId = async (): Promise<{ storageKey: string; isLocalStorage: true }> => {
    const frame: { frameTree: { frame: { id: string } } } =
      await debuggerApi.sendCommand('Page.getFrameTree')
    const result: { storageKey: string } = await debuggerApi.sendCommand(
      'Storage.getStorageKeyForFrame',
      { frameId: frame.frameTree.frame.id }
    )
    return { storageKey: result.storageKey, isLocalStorage: true }
  }
  type StorageId = Awaited<ReturnType<typeof storageId>>
  const items = async (storageId: StorageId): Promise<Map<string, string>> => {
    const result: { entries: [string, string][] } = await debuggerApi.sendCommand(
      'DOMStorage.getDOMStorageItems',
      { storageId }
    )
    return new Map(result.entries)
  }
  try {
    await Promise.race([
      (async () => {
        debuggerApi.attach('1.3')
        await window.loadURL('marka://app/__migration__')
        await debuggerApi.sendCommand('DOMStorage.enable')
        const destinationId = await storageId()
        const existing = await items(destinationId)
        if (existing.get(marker) === 'complete') {
          return
        }
        session.defaultSession.protocol.handle(
          'file',
          request =>
            new Response(request.url === legacyURL ? inertMigrationHtml : 'Forbidden', {
              status: request.url === legacyURL ? 200 : 403,
              headers: { 'content-type': 'text/html; charset=utf-8' }
            })
        )
        intercepted = true
        await window.loadURL(legacyURL)
        const legacy = await items(await storageId())
        const values = new Map<string, string>()
        const rawDraft = legacy.get(draftKey)
        if (rawDraft && rawDraft.length <= editableBytes * 2 + 16_384) {
          let draft: ReturnType<typeof parseDraft> = null
          try {
            draft = parseDraft(JSON.parse(rawDraft))
          } catch {}
          if (draft) {
            values.set(draftKey, JSON.stringify(draft))
          }
        }
        for (const key of ['marka-editor', 'marka-ui', 'marka-connections-v1']) {
          const value = safePreferences(key, legacy.get(key) ?? null)
          if (value) {
            values.set(key, value)
          }
        }
        await window.loadURL('marka://app/__migration__')
        const copied = await items(destinationId)
        for (const [key, value] of values) {
          if (!copied.has(key)) {
            await debuggerApi.sendCommand('DOMStorage.setDOMStorageItem', {
              storageId: destinationId,
              key,
              value
            })
          }
        }
        const verified = await items(destinationId)
        for (const [key, value] of values) {
          if (!copied.has(key) && verified.get(key) !== value) {
            throw new Error('Draft migration verification failed.')
          }
        }
        await debuggerApi.sendCommand('DOMStorage.setDOMStorageItem', {
          storageId: destinationId,
          key: marker,
          value: 'complete'
        })
        session.defaultSession.flushStorageData()
      })(),
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Draft migration timed out.')), 10_000)
      })
    ])
  } finally {
    clearTimeout(timer)
    if (debuggerApi.isAttached()) {
      debuggerApi.detach()
    }
    window.destroy()
    if (intercepted) {
      session.defaultSession.protocol.unhandle('file')
    }
  }
}
