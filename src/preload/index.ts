import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  openFile: (): Promise<{ path: string; content: string } | null> =>
    ipcRenderer.invoke('dialog:openFile'),
  saveFile: (content: string, filePath?: string): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveFile', content, filePath),
  readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('fs:readFile', filePath),
  watchFile: (filePath: string): Promise<void> => ipcRenderer.invoke('fs:watchFile', filePath),

  onFileChanged: (callback: (content: string) => void): (() => void) => {
    ipcRenderer.on('file:changed', (_event, content: string) => callback(content))
    return (): void => {
      ipcRenderer.removeAllListeners('file:changed')
    }
  },

  minimize: (): void => {
    ipcRenderer.send('window:minimize')
  },
  maximize: (): void => {
    ipcRenderer.send('window:maximize')
  },
  close: (): void => {
    ipcRenderer.send('window:close')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  const globalWindow = window as unknown as { electron: unknown; api: unknown }
  globalWindow.electron = electronAPI
  globalWindow.api = api
}
