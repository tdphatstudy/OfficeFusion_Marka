import { ipcMain, dialog, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'fs/promises'

export function registerIpcHandlers(): void {
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
