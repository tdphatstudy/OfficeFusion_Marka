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
    printWindow.destroy()

    await writeFile(result.filePath, pdfData)
    return result.filePath
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
