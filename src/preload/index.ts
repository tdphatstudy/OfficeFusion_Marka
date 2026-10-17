import { contextBridge, ipcRenderer } from 'electron'
import type {
  ConnectedDocument,
  ConnectionCapabilities,
  ConnectionTarget,
  SshCredentials,
  FileLocation
} from '../shared/connections'
import type { OpenedFile, DocumentPage } from '../shared/documents'

const api = {
  connectionCapabilities: (): Promise<ConnectionCapabilities> =>
    ipcRenderer.invoke('connection:capabilities'),
  openConnectedDocument: (
    target: ConnectionTarget,
    credentials?: SshCredentials
  ): Promise<ConnectedDocument> => ipcRenderer.invoke('connection:open', target, credentials),
  saveConnectedDocument: (
    target: FileLocation,
    content: string,
    expectedContent: string
  ): Promise<string> => ipcRenderer.invoke('connection:save', target, content, expectedContent),
  cancelConnection: (): void => {
    ipcRenderer.send('connection:cancel')
  },
  chooseConnectionKey: (): Promise<string | null> => ipcRenderer.invoke('connection:chooseKey'),
  openFile: (): Promise<OpenedFile | null> => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (
    content: string,
    filePath?: string,
    expectedContent?: string
  ): Promise<string | null> =>
    ipcRenderer.invoke('dialog:saveFile', content, filePath, expectedContent),
  refreshFile: (path: string): Promise<OpenedFile> => ipcRenderer.invoke('document:refresh', path),
  readPage: (handle: string, offset: number): Promise<DocumentPage> =>
    ipcRenderer.invoke('document:page', handle, offset),
  closeReader: (handle: string): Promise<void> =>
    ipcRenderer.invoke('document:closeReader', handle),
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

  minimize: (): void => {
    ipcRenderer.send('window:minimize')
  },
  maximize: (): void => {
    ipcRenderer.send('window:maximize')
  },
  close: (): void => {
    ipcRenderer.send('window:close')
  },
  exportPdf: (content: string, title?: string): Promise<string | null> =>
    ipcRenderer.invoke('export:pdf', content, title),
  exportHtml: (content: string, title?: string): Promise<string | null> =>
    ipcRenderer.invoke('export:html', content, title),
  exportTxt: (textContent: string): Promise<string | null> =>
    ipcRenderer.invoke('export:txt', textContent)
}

if (process.contextIsolated && process.isMainFrame) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
}
