import { contextBridge, ipcRenderer } from 'electron'

const api = {
  openFile: (): Promise<{ path: string; content: string } | null> =>
    ipcRenderer.invoke('dialog:openFile'),
  saveFile: (content: string, filePath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveFile', content, filePath),
  confirmUnsavedChanges: (fileName: string): Promise<'save' | 'discard' | 'cancel'> =>
    ipcRenderer.invoke('dialog:confirmUnsavedChanges', fileName),
  confirmClose: (): void => {
    ipcRenderer.send('window:confirmClose')
  },
  onCloseRequested: (callback: () => void): (() => void) => {
    const listener = (): void => callback()
    ipcRenderer.on('window:closeRequested', listener)
    ipcRenderer.send('window:closeGuardReady', true)
    return (): void => {
      ipcRenderer.removeListener('window:closeRequested', listener)
      ipcRenderer.send('window:closeGuardReady', false)
    }
  },
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('fs:readFile', filePath),

  minimize: (): void => {
    ipcRenderer.send('window:minimize')
  },
  maximize: (): void => {
    ipcRenderer.send('window:maximize')
  },
  close: (): void => {
    ipcRenderer.send('window:close')
  },
  exportPdf: (htmlContent: string): Promise<string | null> =>
    ipcRenderer.invoke('export:pdf', htmlContent),
  exportHtml: (htmlContent: string): Promise<string | null> =>
    ipcRenderer.invoke('export:html', htmlContent),
  exportTxt: (textContent: string): Promise<string | null> =>
    ipcRenderer.invoke('export:txt', textContent)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  const globalWindow = window as unknown as { api: unknown }
  globalWindow.api = api
}
