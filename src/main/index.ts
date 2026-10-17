import { app, shell, BrowserWindow, ipcMain, Menu, protocol, net, session } from 'electron'
import { join, resolve, sep } from 'path'
import { pathToFileURL } from 'node:url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'
import { trustWindow, trustedSender } from './ipc/security'
import { migrateLegacyStorage, inertMigrationHtml } from './storageMigration'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'marka',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true }
  }
])

let migration: Promise<void> | undefined

async function createWindow(): Promise<void> {
  const isMac = process.platform === 'darwin'
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: isMac,
    titleBarStyle: isMac ? 'hiddenInset' : 'hidden',
    autoHideMenuBar: true,
    ...(process.platform === 'linux' || process.platform === 'win32'
      ? { icon: join(__dirname, '../../resources/icon.png') }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: true
    }
  })

  mainWindow.setMenu(null)
  let closeApproved = false
  let closeGuardReady = false
  mainWindow.on('close', event => {
    if (!closeApproved && closeGuardReady && !mainWindow.webContents.isDestroyed()) {
      event.preventDefault()
      mainWindow.webContents.send('window:closeRequested')
    }
  })
  const approveClose = (event: Electron.IpcMainEvent): void => {
    if (trustedSender(event) && event.sender === mainWindow.webContents) {
      closeApproved = true
      mainWindow.close()
    }
  }
  ipcMain.on('window:confirmClose', approveClose)
  const updateCloseGuard = (event: Electron.IpcMainEvent, ready: boolean): void => {
    if (trustedSender(event) && event.sender === mainWindow.webContents) {
      closeGuardReady = ready === true
    }
  }
  ipcMain.on('window:closeGuardReady', updateCloseGuard)
  mainWindow.webContents.on('render-process-gone', () => {
    closeGuardReady = false
  })
  mainWindow.webContents.on('did-start-loading', () => {
    closeGuardReady = false
  })
  mainWindow.on('closed', () => {
    ipcMain.removeListener('window:confirmClose', approveClose)
    ipcMain.removeListener('window:closeGuardReady', updateCloseGuard)
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler(details => {
    if (/^https?:|^mailto:/i.test(details.url)) {
      void shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault()
      if (/^https?:|^mailto:/i.test(url)) {
        void shell.openExternal(url)
      }
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = new URL(process.env['ELECTRON_RENDERER_URL']).href
    trustWindow(mainWindow, url)
    mainWindow.loadURL(url)
  } else {
    migration ??= migrateLegacyStorage(
      pathToFileURL(join(__dirname, '../renderer/index.html')).href
    )
    try {
      await migration
    } catch {
      await mainWindow.loadURL(
        'data:text/html,<p>Marka could not migrate document recovery. Close the app and retry. Your previous draft storage is retained.</p>'
      )
      mainWindow.show()
      return
    }
    trustWindow(mainWindow, 'marka://app/index.html')
    mainWindow.loadURL('marka://app/index.html')
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.officefusion.marka')
  Menu.setApplicationMenu(null)
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false)
  )
  session.defaultSession.setPermissionCheckHandler(() => false)
  session.defaultSession.on('will-download', event => event.preventDefault())
  protocol.handle('marka', request => {
    const url = new URL(request.url)
    const root = resolve(__dirname, '../renderer')
    const path = resolve(root, `.${decodeURIComponent(url.pathname)}`)
    if (url.hostname !== 'app' || request.method !== 'GET' || !path.startsWith(`${root}${sep}`)) {
      return new Response('Forbidden', { status: 403 })
    }
    if (url.pathname === '/__migration__') {
      return new Response(inertMigrationHtml, {
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }
    return net.fetch(pathToFileURL(path).href)
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()

  void createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
