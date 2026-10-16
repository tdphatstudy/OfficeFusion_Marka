import type {
  ConnectedDocument,
  ConnectionCapabilities,
  ConnectionTarget,
  SshCredentials,
  FileLocation
} from '../../shared/connections'

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
  openFile: () => Promise<{ path: string; content: string } | null>
  saveFile: (content: string, filePath?: string) => Promise<string | null>
  confirmUnsavedChanges: (fileName: string) => Promise<'save' | 'discard' | 'cancel'>
  confirmClose: () => void
  onCloseRequested: (callback: () => void) => () => void
  readFile: (filePath: string) => Promise<string>
  minimize: () => void
  maximize: () => void
  close: () => void
  exportPdf: (htmlContent: string) => Promise<string | null>
  exportHtml: (htmlContent: string) => Promise<string | null>
  exportTxt: (textContent: string) => Promise<string | null>
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
