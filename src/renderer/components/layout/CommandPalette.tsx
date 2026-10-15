import { useMemo, useState, type FC } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Search, X, ArrowUp, ArrowDown } from 'lucide-react'
import { appCommands } from '@/lib/commands'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'

const CommandList: FC = () => {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const commands = useMemo(
    () =>
      appCommands.filter(command =>
        `${command.group} ${command.label}`.toLowerCase().includes(query.toLowerCase().trim())
      ),
    [query]
  )
  const execute = (index: number): void => {
    const command = commands[index]
    if (command) {
      useUIStore.getState().setCommandOpen(false)
      void command.run()
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Search size={18} className="text-accent" />
        <input
          aria-label="Search commands"
          role="combobox"
          aria-expanded
          aria-controls="command-results"
          aria-activedescendant={commands[active] ? `command-${commands[active].id}` : undefined}
          autoComplete="off"
          placeholder="Search actions, views, templates…"
          value={query}
          onChange={event => {
            setQuery(event.target.value)
            setActive(0)
          }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              const direction = event.key === 'ArrowDown' ? 1 : -1
              const index = (active + direction + commands.length) % Math.max(1, commands.length)
              setActive(index)
              document
                .getElementById(`command-${commands[index]?.id}`)
                ?.scrollIntoView({ block: 'nearest' })
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              execute(active)
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-text-primary outline-none"
        />
        <Dialog.Close className="icon-button" aria-label="Close commands">
          <X size={16} />
        </Dialog.Close>
      </div>
      <div
        id="command-results"
        role="listbox"
        aria-label="Commands"
        className="max-h-[min(55vh,400px)] overflow-auto p-2"
      >
        {commands.length === 0 && (
          <p role="status" className="p-8 text-center text-sm text-text-muted">
            No commands found. Try “theme” or “notes”.
          </p>
        )}
        {commands.map((command, index) => (
          <button
            key={command.id}
            id={`command-${command.id}`}
            role="option"
            aria-selected={active === index}
            tabIndex={-1}
            type="button"
            onClick={() => execute(index)}
            onMouseMove={() => setActive(index)}
            className={cn(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm',
              active === index
                ? 'bg-accent/10 text-accent'
                : 'text-text-primary hover:bg-surface-raised'
            )}
          >
            <span className="w-20 shrink-0 text-[11px] text-text-muted">{command.group}</span>
            <span className="flex-1">{command.label}</span>
            {command.shortcut && (
              <kbd className="text-[10px] text-text-muted">
                {command.shortcut.replace(
                  'Mod',
                  navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'
                )}
              </kbd>
            )}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 border-t border-border px-4 py-2 text-[11px] text-text-muted">
        <ArrowUp size={12} />
        <ArrowDown size={12} /> navigate <span className="ml-3">Enter to run · Esc to close</span>
      </div>
    </>
  )
}

export const CommandPalette: FC = () => {
  const open = useUIStore(state => state.commandOpen)
  return (
    <Dialog.Root open={open} onOpenChange={useUIStore.getState().setCommandOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="dialog-content top-[15%] max-w-xl"
          aria-describedby="commands-description"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description id="commands-description" className="sr-only">
            Search and run editor actions. Use the arrow keys to select and Enter to run.
          </Dialog.Description>
          <CommandList />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
