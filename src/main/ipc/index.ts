import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { parseTarget, targetLabel, type SshCredentials } from '../../shared/connections'
import {
  connectionCapabilities,
  openConnectedDocument,
  saveConnectedDocument
} from '../connections'

export function registerIpcHandlers(): void {
  const credentials = new Map<number, Map<string, { value: SshCredentials; expires: number }>>()
  const connectionKey = (target: unknown): string => {
    const parsed = parseTarget(target)
    return `${targetLabel(parsed)}|${parsed.kind === 'ssh' ? parsed.fingerprint : ''}`
  }
  const connections = new Map<number, AbortController>()
  const withConnection = async <T>(
    event: Electron.IpcMainInvokeEvent,
    action: (signal: AbortSignal) => Promise<T>
  ): Promise<T> => {
    if (connections.has(event.sender.id)) {
      throw new Error('A connection operation is already running.')
    }
    const controller = new AbortController()
    const senderId = event.sender.id
    const abort = (): void => controller.abort(new Error('Connection cancelled.'))
    const timer = setTimeout(
      () => controller.abort(new Error('Connection timed out. Check the path, host and network.')),
      30_000
    )
    const interrupted = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener('abort', () => reject(controller.signal.reason), {
        once: true
      })
    })
    connections.set(senderId, controller)
    event.sender.once('destroyed', abort)
    try {
      return await Promise.race([action(controller.signal), interrupted])
    } catch (error: unknown) {
      if (controller.signal.aborted) {
        throw controller.signal.reason
      }
      throw error
    } finally {
      clearTimeout(timer)
      connections.delete(senderId)
      if (!event.sender.isDestroyed()) {
        event.sender.removeListener('destroyed', abort)
      }
    }
  }
  ipcMain.handle('connection:capabilities', () => connectionCapabilities())
  ipcMain.handle('connection:open', (event, target: unknown, auth: SshCredentials | undefined) =>
    withConnection(event, async signal => {
      const result = await openConnectedDocument(target, signal, auth)
      if (result.location?.kind === 'ssh' && auth) {
        let session = credentials.get(event.sender.id)
        if (!session) {
          session = new Map()
          credentials.set(event.sender.id, session)
          const senderId = event.sender.id
          event.sender.once('destroyed', () => {
            session?.clear()
            credentials.delete(senderId)
          })
          event.sender.on('render-process-gone', () => session?.clear())
          event.sender.on('did-start-navigation', (_event, _url, _inPlace, isMainFrame) => {
            if (isMainFrame) {
              session?.clear()
            }
          })
        }
        if (session.size >= 8) {
          session.clear()
        }
        const key = connectionKey(result.location)
        const expires = Date.now() + 30 * 60_000
        session.set(key, { value: auth, expires })
        setTimeout(() => {
          if (session?.get(key)?.expires === expires) {
            session.delete(key)
          }
        }, 30 * 60_000).unref()
      }
      return result
    })
  )
  ipcMain.handle('connection:save', (event, target: unknown, content: unknown, expected: unknown) =>
    withConnection(event, signal => {
      const session = credentials.get(event.sender.id)
      const key = connectionKey(target)
      const auth = session?.get(key)
      if (!auth || auth.expires < Date.now()) {
        session?.delete(key)
        throw new Error(
          'SSH session expired. Save As a local copy before reconnecting, or copy your edits and reopen the connection.'
        )
      }
      return saveConnectedDocument(target, content, expected, signal, auth.value)
    })
  )
  ipcMain.on('connection:cancel', event => {
    connections.get(event.sender.id)?.abort(new Error('Connection cancelled.'))
  })
  ipcMain.handle('connection:chooseKey', async event => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) {
      return null
    }
    const result = await dialog.showOpenDialog(window, {
      title: 'Choose SSH private key (explicit selection only)',
      properties: ['openFile']
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
  ipcMain.handle('dialog:confirmUnsavedChanges', async (event, fileName: string) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const options = {
      type: 'warning' as const,
      title: 'Unsaved changes',
      message: `Save changes to ${fileName}?`,
      detail: 'Your changes will be lost if you discard them.',
      buttons: ['Save', 'Discard changes', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    }
    const result = window
      ? await dialog.showMessageBox(window, options)
      : await dialog.showMessageBox(options)
    return ['save', 'discard', 'cancel'][result.response] ?? 'cancel'
  })
  ipcMain.handle('app:version', () => '0.1.0')

  ipcMain.handle('dialog:openFile', async () => {
    const window = BrowserWindow.getFocusedWindow()
    const options = {
      title: 'Open Markdown File',
      filters: [
        { name: 'Markdown Files', extensions: ['md', 'markdown', 'mdx', 'txt'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile' as const]
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    const filePath = result.filePaths[0]
    if (!filePath) {
      return null
    }

    const content = await readFile(filePath, 'utf-8')
    return { path: filePath, content }
  })

  ipcMain.handle('dialog:saveFile', async (_, content: string, filePath?: string) => {
    let targetPath = filePath

    if (!targetPath) {
      const window = BrowserWindow.getFocusedWindow()
      const options = {
        title: 'Save Markdown File',
        defaultPath: 'Untitled.md',
        filters: [
          { name: 'Markdown Files', extensions: ['md', 'markdown'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      }
      const result = window
        ? await dialog.showSaveDialog(window, options)
        : await dialog.showSaveDialog(options)

      if (result.canceled || !result.filePath) {
        return null
      }
      targetPath = result.filePath
    }

    await writeFile(targetPath, content, 'utf-8')
    return targetPath
  })

  ipcMain.handle('fs:readFile', async (_, filePath: string) => {
    return await readFile(filePath, 'utf-8')
  })

  ipcMain.handle('export:pdf', async (_, htmlContent: string) => {
    const window = BrowserWindow.getFocusedWindow()
    const options = {
      title: 'Export Document to PDF',
      defaultPath: 'Document.pdf',
      filters: [{ name: 'PDF Documents', extensions: ['pdf'] }]
    }
    const result = window
      ? await dialog.showSaveDialog(window, options)
      : await dialog.showSaveDialog(options)

    if (result.canceled || !result.filePath) {
      return null
    }

    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    try {
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`)
      const pdfData = await printWindow.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        margins: {
          marginType: 'custom',
          top: 0.75,
          bottom: 0.75,
          left: 0.75,
          right: 0.75
        }
      })
      await writeFile(result.filePath, pdfData)
      return result.filePath
    } finally {
      printWindow.destroy()
    }
  })

  ipcMain.handle('export:html', async (_, htmlContent: string) => {
    const window = BrowserWindow.getFocusedWindow()
    const options = {
      title: 'Export Document to HTML',
      defaultPath: 'Document.html',
      filters: [{ name: 'HTML Document', extensions: ['html', 'htm'] }]
    }
    const result = window
      ? await dialog.showSaveDialog(window, options)
      : await dialog.showSaveDialog(options)

    if (result.canceled || !result.filePath) {
      return null
    }

    await writeFile(result.filePath, htmlContent, 'utf-8')
    return result.filePath
  })

  ipcMain.handle('export:txt', async (_, textContent: string) => {
    const window = BrowserWindow.getFocusedWindow()
    const options = {
      title: 'Export Document to Plain Text',
      defaultPath: 'Document.txt',
      filters: [{ name: 'Text Document', extensions: ['txt'] }]
    }
    const result = window
      ? await dialog.showSaveDialog(window, options)
      : await dialog.showSaveDialog(options)

    if (result.canceled || !result.filePath) {
      return null
    }

    await writeFile(result.filePath, textContent, 'utf-8')
    return result.filePath
  })

  ipcMain.on('window:minimize', event => {
    const window = BrowserWindow.fromWebContents(event.sender)
    window?.minimize()
  })

  ipcMain.on('window:maximize', event => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window?.isMaximized()) {
      window.unmaximize()
    } else {
      window?.maximize()
    }
  })

  ipcMain.on('window:close', event => {
    const window = BrowserWindow.fromWebContents(event.sender)
    window?.close()
  })
}
