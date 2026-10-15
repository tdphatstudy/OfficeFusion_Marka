import { app, shell, BrowserWindow, ipcMain, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers } from './ipc'

function createWindow(): void {
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
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
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
    if (event.sender === mainWindow.webContents) {
      closeApproved = true
      mainWindow.close()
    }
  }
  ipcMain.on('window:confirmClose', approveClose)
  const updateCloseGuard = (event: Electron.IpcMainEvent, ready: boolean): void => {
    if (event.sender === mainWindow.webContents) {
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
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.officefusion.marka')
  Menu.setApplicationMenu(null)

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.on('ping', () => console.info('pong'))

  registerIpcHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
