import { randomUUID } from 'node:crypto'
import { isAbsolute } from 'node:path'
import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import { parseTarget, targetLabel, wslPath, type SshCredentials } from '../../shared/connections'
import { FileBrowser, checkedBrowserQuery, wslHome } from '../browser'
import { checkedContent, exportCharacters } from '../../shared/documents'
import {
  connectionCapabilities,
  openConnectedDocument,
  saveConnectedDocument
} from '../connections'
import { FileAccess } from '../files'
import { renderExport } from '../export'
import { assertSender, trustedSender } from './security'

function checkedPath(value: unknown): string {
  if (
    typeof value !== 'string' ||
    !isAbsolute(value) ||
    value.length > 4096 ||
    /[\x00-\x1f]/.test(value)
  ) {
    throw new Error('Invalid file path.')
  }
  return value
}

function parseAuth(value: unknown): SshCredentials | undefined {
  if (value === undefined) {
    return undefined
  }
  if (value && typeof value === 'object' && 'method' in value) {
    if (
      value.method === 'password' &&
      'password' in value &&
      typeof value.password === 'string' &&
      value.password.length <= 4096
    ) {
      return { method: 'password', password: value.password }
    }
    if (value.method === 'key' && 'keyPath' in value && typeof value.keyPath === 'string') {
      const keyPath = checkedPath(value.keyPath)
      const passphrase = 'passphrase' in value ? value.passphrase : undefined
      if (
        passphrase === undefined ||
        (typeof passphrase === 'string' && passphrase.length <= 4096)
      ) {
        return { method: 'key', keyPath, passphrase }
      }
    }
  }
  throw new Error('Invalid SSH authentication.')
}

export function registerIpcHandlers(): void {
  const files = new Map<number, FileAccess>()
  const credentials = new Map<number, Map<string, { value: SshCredentials; expires: number }>>()
  const keyGrants = new Map<number, Set<string>>()
  const connections = new Map<number, AbortController>()
  const browsers = new Map<number, FileBrowser>()
  const browserTimers = new Map<number, ReturnType<typeof setTimeout>>()
  const clearBrowser = (owner: number): void => {
    clearTimeout(browserTimers.get(owner))
    browserTimers.delete(owner)
    browsers.delete(owner)
  }
  const expireBrowser = (owner: number, id: string, expires: number): void => {
    browserTimers.set(
      owner,
      setTimeout(
        () => {
          if (browsers.get(owner)?.session.id === id) {
            clearBrowser(owner)
          }
        },
        Math.max(0, expires - Date.now())
      ).unref()
    )
  }
  const pending = new Map<number, number>()
  const exports = new Set<number>()
  const requests = new WeakMap<
    Electron.IpcMainInvokeEvent,
    { access: FileAccess; generation: number }
  >()
  const assertCurrent = (event: Electron.IpcMainInvokeEvent): void => {
    assertSender(event)
    const request = requests.get(event)
    if (!request || request.access.generation !== request.generation) {
      throw new Error('Window changed during the operation. Try again.')
    }
  }
  const access = (event: Electron.IpcMainInvokeEvent): FileAccess => {
    let value = files.get(event.sender.id)
    if (!value) {
      value = new FileAccess()
      const owner = event.sender.id
      files.set(owner, value)
      const cleanup = (): void => {
        void value?.dispose()
        credentials.get(owner)?.clear()
        keyGrants.delete(owner)
        connections.get(owner)?.abort()
        clearBrowser(owner)
      }
      event.sender.once('destroyed', () => {
        cleanup()
        files.delete(owner)
        credentials.delete(owner)
      })
      event.sender.on('render-process-gone', cleanup)
      event.sender.on('did-start-navigation', (_event, _url, inPlace, mainFrame) => {
        if (mainFrame && !inPlace) {
          cleanup()
        }
      })
    }
    return value
  }
  const handle = (
    channel: string,
    handler: (event: Electron.IpcMainInvokeEvent, ...args: unknown[]) => unknown
  ): void => {
    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      assertSender(event)
      const fileAccess = access(event)
      requests.set(event, { access: fileAccess, generation: fileAccess.generation })
      const count = pending.get(event.sender.id) ?? 0
      if (count >= 4) {
        throw new Error('Too many file operations. Wait for the current operation.')
      }
      pending.set(event.sender.id, count + 1)
      try {
        const result = await handler(event, ...args)
        assertCurrent(event)
        return result
      } finally {
        pending.set(event.sender.id, Math.max(0, (pending.get(event.sender.id) ?? 1) - 1))
      }
    })
  }
  const key = (target: unknown): string => {
    const parsed = parseTarget(target)
    return `${targetLabel(parsed)}|${parsed.kind === 'ssh' ? parsed.fingerprint : ''}`
  }
  const withConnection = async <T>(
    event: Electron.IpcMainInvokeEvent,
    action: (signal: AbortSignal) => Promise<T>
  ): Promise<T> => {
    access(event)
    if (connections.has(event.sender.id)) {
      throw new Error('A connection operation is already running.')
    }
    const controller = new AbortController()
    connections.set(event.sender.id, controller)
    const timer = setTimeout(() => controller.abort(new Error('Connection timed out.')), 30_000)
    try {
      return await Promise.race([
        action(controller.signal),
        new Promise<never>((_resolve, reject) =>
          controller.signal.addEventListener(
            'abort',
            () => reject(new Error('Connection cancelled.')),
            { once: true }
          )
        )
      ])
    } finally {
      clearTimeout(timer)
      if (connections.get(event.sender.id) === controller) {
        connections.delete(event.sender.id)
      }
    }
  }
  handle('connection:capabilities', () => connectionCapabilities())
  const rememberCredentials = (owner: number, target: unknown, auth: SshCredentials): void => {
    const session = credentials.get(owner) ?? new Map()
    if (session.size >= 8) {
      session.clear()
    }
    const expires = Date.now() + 30 * 60_000
    const destination = key(target)
    session.set(destination, { value: auth, expires })
    credentials.set(owner, session)
    setTimeout(() => {
      if (session.get(destination)?.expires === expires) {
        session.delete(destination)
      }
    }, 30 * 60_000).unref()
  }
  const browser = (event: Electron.IpcMainInvokeEvent, id: unknown): FileBrowser => {
    const value = browsers.get(event.sender.id)
    if (!value || value.session.id !== id || value.expires < Date.now()) {
      clearBrowser(event.sender.id)
      throw new Error('Folder session expired. Connect again to continue.')
    }
    return value
  }
  handle('browser:start', (event, source, rawAuth) =>
    withConnection(event, async signal => {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window || !source || typeof source !== 'object' || !('kind' in source)) {
        throw new Error('Choose a file source.')
      }
      let value: FileBrowser
      if (source.kind === 'local') {
        const result = await dialog.showOpenDialog(window, {
          title: 'Choose a folder to browse',
          properties: ['openDirectory']
        })
        if (result.canceled || !result.filePaths[0]) {
          return null
        }
        value = await FileBrowser.local(result.filePaths[0])
      } else if (
        source.kind === 'wsl' &&
        'distribution' in source &&
        typeof source.distribution === 'string'
      ) {
        if (process.platform !== 'win32') {
          throw new Error('WSL browsing is available on Windows.')
        }
        const root = wslPath(source.distribution, '/')
        const result = await dialog.showMessageBox(window, {
          type: 'question',
          title: 'Browse WSL files',
          message: `Allow browsing ${source.distribution}?`,
          detail:
            'Browse folders and choose a document to open. Your current document stays open until you select another file.',
          buttons: ['Cancel', 'Browse'],
          cancelId: 0,
          defaultId: 1
        })
        if (result.response !== 1) {
          return null
        }
        const home = await wslHome(source.distribution, signal)
        value = await FileBrowser.local(
          root,
          wslPath(source.distribution, home),
          `WSL · ${source.distribution}`
        )
      } else {
        const target = parseTarget(source)
        const auth = parseAuth(rawAuth)
        if (target.kind !== 'ssh' || !auth) {
          throw new Error('Enter SSH authentication to browse.')
        }
        if (auth.method === 'key' && !keyGrants.get(event.sender.id)?.has(auth.keyPath)) {
          throw new Error('Choose this private key through the file picker first.')
        }
        value = await FileBrowser.remote(target, auth, signal)
      }
      signal.throwIfAborted()
      assertCurrent(event)
      clearBrowser(event.sender.id)
      browsers.set(event.sender.id, value)
      expireBrowser(event.sender.id, value.session.id, value.expires)
      return value.session
    })
  )
  handle('browser:list', (event, id, query) =>
    withConnection(event, signal => browser(event, id).list(checkedBrowserQuery(query), signal))
  )
  handle('browser:open', (event, id, rawPath) =>
    withConnection(event, async signal => {
      if (typeof rawPath !== 'string') {
        throw new Error('Choose a file.')
      }
      const value = browser(event, id)
      const path = await value.checkedPath(rawPath)
      if (value.ssh) {
        const target = { ...value.ssh.target, path }
        const result = await openConnectedDocument(target, signal, value.ssh.credentials)
        signal.throwIfAborted()
        assertCurrent(event)
        rememberCredentials(event.sender.id, target, value.ssh.credentials)
        return result
      }
      signal.throwIfAborted()
      const result = await access(event).open(path)
      signal.throwIfAborted()
      return {
        ...result,
        location: { kind: 'local', path },
        name: path.split(/[\\/]/).pop() ?? 'Document.md'
      }
    })
  )
  handle('browser:close', (event, id) => {
    if (browsers.get(event.sender.id)?.session.id === id) {
      connections.get(event.sender.id)?.abort()
      clearBrowser(event.sender.id)
    }
  })
  handle('connection:open', (event, rawTarget, rawAuth) =>
    withConnection(event, async signal => {
      const target = parseTarget(rawTarget)
      const fileAccess = access(event)
      if (target.kind === 'local') {
        const window = BrowserWindow.fromWebContents(event.sender)
        if (!window) {
          throw new Error('Window closed.')
        }
        const permission = await dialog.showMessageBox(window, {
          type: 'question',
          title: 'Open file location',
          message: 'Open this file?',
          detail: checkedPath(target.path),
          buttons: ['Cancel', 'Open'],
          defaultId: 1,
          cancelId: 0
        })
        if (permission.response !== 1) {
          throw new Error('Connection cancelled.')
        }
        signal.throwIfAborted()
        assertCurrent(event)
        const result = await fileAccess.open(target.path)
        return {
          ...result,
          location: target,
          name: target.path.split(/[\\/]/).pop() ?? 'Document.md'
        }
      }
      const auth = parseAuth(rawAuth)
      if (auth?.method === 'key' && !keyGrants.get(event.sender.id)?.has(auth.keyPath)) {
        throw new Error('Choose this private key through the file picker first.')
      }
      const result = await openConnectedDocument(target, signal, auth)
      signal.throwIfAborted()
      if (result.location?.kind === 'ssh' && auth) {
        rememberCredentials(event.sender.id, result.location, auth)
      }
      return result
    })
  )
  handle('connection:save', (event, target, content, expected) =>
    withConnection(event, signal => {
      const session = credentials.get(event.sender.id)
      const auth = session?.get(key(target))
      if (!auth || auth.expires < Date.now()) {
        session?.delete(key(target))
        throw new Error('SSH session expired. Save As a local copy or reconnect before saving.')
      }
      return saveConnectedDocument(
        target,
        checkedContent(content),
        checkedContent(expected),
        signal,
        auth.value
      )
    })
  )
  ipcMain.on('connection:cancel', event => {
    if (trustedSender(event)) {
      connections.get(event.sender.id)?.abort()
    }
  })
  handle('connection:chooseKey', async event => {
    access(event)
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) {
      return null
    }
    const result = await dialog.showOpenDialog(window, {
      title: 'Choose SSH private key (explicit selection only)',
      properties: ['openFile']
    })
    const path = result.filePaths[0]
    if (result.canceled || !path) {
      return null
    }
    assertCurrent(event)
    const grants = keyGrants.get(event.sender.id) ?? new Set<string>()
    grants.add(path)
    keyGrants.set(event.sender.id, grants)
    return path
  })
  handle('dialog:confirmUnsavedChanges', async (event, value) => {
    const fileName = typeof value === 'string' ? value.slice(0, 256) : 'Document'
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) {
      return 'cancel'
    }
    const result = await dialog.showMessageBox(window, {
      type: 'warning',
      title: 'Unsaved changes',
      message: `Save changes to ${fileName}?`,
      detail: 'Your changes will be lost if you discard them.',
      buttons: ['Save', 'Discard changes', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    })
    return ['save', 'discard', 'cancel'][result.response] ?? 'cancel'
  })
  handle('app:version', () => app.getVersion())
  handle('dialog:openFile', async event => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) {
      return null
    }
    const result = await dialog.showOpenDialog(window, {
      title: 'Open Markdown File',
      filters: [
        { name: 'Markdown Files', extensions: ['md', 'markdown', 'mdx', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    assertCurrent(event)
    return result.canceled || !result.filePaths[0] ? null : access(event).open(result.filePaths[0])
  })
  handle('document:refresh', (event, path) => access(event).refresh(checkedPath(path)))
  handle('document:inspect', (event, rawTarget, reload) =>
    withConnection(event, async signal => {
      if (typeof reload !== 'boolean') {
        throw new Error('Invalid comparison request.')
      }
      const target = parseTarget(rawTarget)
      if (target.kind === 'url') {
        throw new Error('Choose an opened document.')
      }
      if (target.kind === 'local') {
        const result = reload
          ? await access(event).refresh(checkedPath(target.path))
          : await access(event).inspect(checkedPath(target.path))
        return {
          ...result,
          location: target,
          name: target.path.split(/[\\/]/).pop() ?? 'Document.md'
        }
      }
      const auth = credentials.get(event.sender.id)?.get(key(target))
      if (!auth || auth.expires < Date.now()) {
        throw new Error('SSH session expired. Reconnect or save a local copy.')
      }
      return openConnectedDocument(target, signal, auth.value)
    })
  )
  handle('document:page', (event, handle, offset) => {
    if (typeof handle !== 'string' || typeof offset !== 'number') {
      throw new Error('Invalid page request.')
    }
    return access(event).page(handle, offset)
  })
  handle('document:closeReader', (event, handle) => {
    if (typeof handle !== 'string') {
      throw new Error('Invalid reader.')
    }
    return access(event).closeReader(handle)
  })
  handle('dialog:saveFile', async (event, value, path, expected) => {
    const content = checkedContent(value)
    const fileAccess = access(event)
    if (path !== undefined) {
      await fileAccess.save(checkedPath(path), content, checkedContent(expected))
      return path
    }
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) {
      return null
    }
    const result = await dialog.showSaveDialog(window, {
      title: 'Save Markdown File',
      defaultPath: 'Untitled.md',
      filters: [{ name: 'Markdown Files', extensions: ['md', 'markdown'] }]
    })
    if (result.canceled || !result.filePath) {
      return null
    }
    assertCurrent(event)
    await fileAccess.saveAsText(result.filePath, content)
    return result.filePath
  })
  for (const format of ['pdf', 'html', 'txt']) {
    handle(`export:${format}`, async (event, value, rawTitle) => {
      const content = checkedContent(value, exportCharacters)
      const title = typeof rawTitle === 'string' ? rawTitle.slice(0, 256) : 'Document'
      if (exports.has(event.sender.id) || exports.size >= 2) {
        throw new Error('An export is already running.')
      }
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window) {
        return null
      }
      exports.add(event.sender.id)
      try {
        const result = await dialog.showSaveDialog(window, {
          title: `Export ${format.toUpperCase()}`,
          defaultPath: `Document.${format}`,
          filters: [{ name: format.toUpperCase(), extensions: [format] }]
        })
        if (result.canceled || !result.filePath) {
          return null
        }
        assertCurrent(event)
        const fileAccess = access(event)
        const expected = await fileAccess.prepareSaveAs(result.filePath)
        const rendered = await renderExport(content, title, format)
        let bytes: Uint8Array = Buffer.from(rendered)
        if (format === 'pdf') {
          const print = new BrowserWindow({
            show: false,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              sandbox: true,
              javascript: false,
              partition: `marka-print-${randomUUID()}`
            }
          })
          print.webContents.session.setPermissionRequestHandler(
            (_contents, _permission, callback) => callback(false)
          )
          print.webContents.session.setPermissionCheckHandler(() => false)
          print.webContents.session.webRequest.onBeforeRequest((details, callback) =>
            callback({ cancel: !details.url.startsWith('data:') })
          )
          print.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
          print.webContents.on('will-navigate', event => event.preventDefault())
          let timer: ReturnType<typeof setTimeout> | undefined
          try {
            bytes = await Promise.race([
              print
                .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(rendered)}`)
                .then(() =>
                  print.webContents.printToPDF({
                    printBackground: true,
                    pageSize: 'A4',
                    margins: { top: 0.75, bottom: 0.75, left: 0.75, right: 0.75 }
                  })
                ),
              new Promise<never>((_resolve, reject) => {
                timer = setTimeout(() => reject(new Error('PDF printing timed out.')), 20_000)
              })
            ])
          } finally {
            clearTimeout(timer)
            print.destroy()
          }
        }
        assertCurrent(event)
        await fileAccess.saveAs(result.filePath, bytes, expected, () => assertCurrent(event))
        return result.filePath
      } finally {
        exports.delete(event.sender.id)
      }
    })
  }
  for (const action of ['minimize', 'maximize', 'close']) {
    ipcMain.on(`window:${action}`, event => {
      if (!trustedSender(event)) {
        return
      }
      const window = BrowserWindow.fromWebContents(event.sender)
      if (action === 'minimize') {
        window?.minimize()
      }
      if (action === 'close') {
        window?.close()
      }
      if (action === 'maximize') {
        if (window?.isMaximized()) {
          window.unmaximize()
        } else {
          window?.maximize()
        }
      }
    })
  }
}
