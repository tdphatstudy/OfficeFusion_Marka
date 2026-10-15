import type { FC } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useEditorStore } from '@/stores/editorStore'

export const SettingsDialog: FC = () => {
  const open = useUIStore(state => state.settingsOpen)
  const theme = useUIStore(state => state.theme)
  const config = useEditorStore(state => state.config)
  const updateConfig = useEditorStore(state => state.updateConfig)
  return (
    <Dialog.Root open={open} onOpenChange={useUIStore.getState().setSettingsOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content top-[12%] max-w-md p-6">
          <div className="flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">
              Make room for your writing
            </Dialog.Title>
            <Dialog.Close aria-label="Close settings" className="icon-button">
              <X size={18} />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-2 text-sm text-text-secondary">
            Preferences apply immediately and stay on this device.
          </Dialog.Description>
          <div className="mt-6 space-y-5 text-sm">
            <label className="settings-row">
              Appearance
              <select
                aria-label="Appearance"
                value={theme}
                onChange={event => {
                  const value = event.target.value
                  if (value === 'light' || value === 'dark' || value === 'system') {
                    useUIStore.getState().setTheme(value)
                  }
                }}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label className="settings-row">
              Writing font
              <select
                aria-label="Writing font"
                value={config.fontFamily}
                onChange={event => {
                  const value = event.target.value
                  if (value === 'sans' || value === 'mono' || value === 'prose') {
                    updateConfig({ fontFamily: value })
                  }
                }}
              >
                <option value="sans">Sans serif</option>
                <option value="prose">Serif</option>
                <option value="mono">Monospace</option>
              </select>
            </label>
            <label className="settings-row">
              Font size{' '}
              <span className="flex items-center gap-2">
                <input
                  aria-label="Font size"
                  type="range"
                  min="12"
                  max="24"
                  value={config.fontSize}
                  onChange={event => updateConfig({ fontSize: Number(event.target.value) })}
                />
                <output className="w-9 text-right">{config.fontSize}px</output>
              </span>
            </label>
            <label className="settings-row">
              Line height
              <select
                aria-label="Line height"
                value={config.lineHeight}
                onChange={event => updateConfig({ lineHeight: Number(event.target.value) })}
              >
                <option value="1.4">Compact</option>
                <option value="1.65">Comfortable</option>
                <option value="1.9">Spacious</option>
              </select>
            </label>
            <label className="settings-row">
              Tab size
              <select
                aria-label="Tab size"
                value={config.tabSize}
                onChange={event => updateConfig({ tabSize: Number(event.target.value) })}
              >
                <option value="2">2 spaces</option>
                <option value="4">4 spaces</option>
              </select>
            </label>
            <label className="settings-row">
              Wrap source lines
              <input
                type="checkbox"
                checked={config.wordWrap}
                onChange={event => updateConfig({ wordWrap: event.target.checked })}
              />
            </label>
            <label className="settings-row">
              Show line numbers
              <input
                type="checkbox"
                checked={config.showLineNumbers}
                onChange={event => updateConfig({ showLineNumbers: event.target.checked })}
              />
            </label>
            <label className="settings-row">
              Full width rich canvas
              <input
                type="checkbox"
                checked={config.fullWidth}
                onChange={event => updateConfig({ fullWidth: event.target.checked })}
              />
            </label>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
