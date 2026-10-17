import type { BrowserWindow } from 'electron'

const trustedWindows = new Map<number, string>()

export function trustWindow(window: BrowserWindow, url: string): void {
  const owner = window.webContents.id
  trustedWindows.set(owner, url)
  window.once('closed', () => trustedWindows.delete(owner))
}

export function assertSender(event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): void {
  const expected = trustedWindows.get(event.sender.id)
  const frame = event.senderFrame
  if (
    !expected ||
    !frame ||
    frame !== event.sender.mainFrame ||
    frame.url !== expected ||
    event.sender.isDestroyed()
  ) {
    throw new Error('Untrusted IPC sender.')
  }
}

export function trustedSender(event: Electron.IpcMainEvent): boolean {
  try {
    assertSender(event)
    return true
  } catch {
    return false
  }
}
