import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { CommandItem } from './slashCommands'
import { cn } from '@/lib/utils'

export interface SlashCommandMenuRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean
}

interface SlashCommandMenuProps {
  items: CommandItem[]
  command: (item: CommandItem) => void
}

export const SlashCommandMenu = forwardRef<SlashCommandMenuRef, SlashCommandMenuProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0)
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

    useEffect(() => {
      setSelectedIndex(0)
    }, [items])

    useEffect(() => {
      const activeEl = itemRefs.current[selectedIndex]
      if (activeEl) {
        activeEl.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth'
        })
      }
    }, [selectedIndex])

    const selectItem = (index: number): void => {
      const item = items[index]
      if (item) {
        command(item)
      }
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }): boolean => {
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setSelectedIndex(prev => (prev + items.length - 1) % items.length)
          return true
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setSelectedIndex(prev => (prev + 1) % items.length)
          return true
        }

        if (event.key === 'Enter') {
          event.preventDefault()
          selectItem(selectedIndex)
          return true
        }

        return false
      }
    }))

    if (items.length === 0) {
      return (
        <div className="rounded-lg border border-border bg-surface-overlay p-2 text-xs text-text-muted shadow-lg">
          No matching blocks found
        </div>
      )
    }

    return (
      <div className="z-50 max-h-80 w-72 overflow-y-auto rounded-xl border border-border bg-surface-overlay/95 p-1.5 shadow-2xl backdrop-blur-md">
        <div className="px-2 py-1 text-[10px] font-semibold tracking-wider text-text-muted uppercase">
          Blocks & Formatting
        </div>
        <div className="mt-1 space-y-0.5">
          {items.map((item, index) => {
            const Icon = item.icon
            const isSelected = index === selectedIndex

            return (
              <button
                key={item.title}
                ref={el => {
                  itemRefs.current[index] = el
                }}
                type="button"
                onClick={(): void => selectItem(index)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors',
                  isSelected ? 'bg-accent text-white' : 'text-text-primary hover:bg-surface-raised'
                )}
              >
                <div
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs',
                    isSelected
                      ? 'border-white/20 bg-white/10 text-white'
                      : 'border-border bg-surface text-text-secondary'
                  )}
                >
                  <Icon size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium leading-none">{item.title}</div>
                  <div
                    className={cn(
                      'mt-0.5 truncate text-[11px]',
                      isSelected ? 'text-white/80' : 'text-text-muted'
                    )}
                  >
                    {item.description}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }
)

SlashCommandMenu.displayName = 'SlashCommandMenu'
