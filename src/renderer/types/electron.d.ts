export interface ElectronAPI {
  openFile: () => Promise<{ path: string; content: string } | null>
  saveFile: (content: string, filePath?: string) => Promise<string | null>
  readFile: (filePath: string) => Promise<string>
  watchFile: (filePath: string) => Promise<void>
  onFileChanged: (callback: (content: string) => void) => () => void
  minimize: () => void
  maximize: () => void
  close: () => void
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}
