import type {
  ConnectedDocument,
  ConnectionCapabilities,
  ConnectionTarget,
  SshCredentials,
  FileLocation
} from '../../shared/connections'
import type { OpenedFile, DocumentPage } from '../../shared/documents'

export interface ElectronAPI {
  connectionCapabilities: () => Promise<ConnectionCapabilities>
  openConnectedDocument: (
    target: ConnectionTarget,
    credentials?: SshCredentials
  ) => Promise<ConnectedDocument>
  saveConnectedDocument: (
    target: FileLocation,
    content: string,
    expectedContent: string
  ) => Promise<string>
  cancelConnection: () => void
  chooseConnectionKey: () => Promise<string | null>
  openFile: () => Promise<OpenedFile | null>
  saveFile: (content: string, filePath?: string, expectedContent?: string) => Promise<string | null>
  refreshFile: (path: string) => Promise<OpenedFile>
  readPage: (handle: string, offset: number) => Promise<DocumentPage>
  closeReader: (handle: string) => Promise<void>
  confirmUnsavedChanges: (fileName: string) => Promise<'save' | 'discard' | 'cancel'>
  confirmClose: () => void
  onCloseRequested: (callback: () => void) => () => void
  minimize: () => void
  maximize: () => void
  close: () => void
  exportPdf: (content: string, title?: string) => Promise<string | null>
  exportHtml: (content: string, title?: string) => Promise<string | null>
  exportTxt: (textContent: string) => Promise<string | null>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
