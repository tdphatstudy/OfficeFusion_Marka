import { useEffect, useMemo, useRef, useState, type FC } from 'react'
import type { Editor } from '@tiptap/core'
import { closeHistory } from '@tiptap/pm/history'
import { findRichText } from '@/lib/richSearch'
import { useUIStore } from '@/stores/uiStore'

export const RichFind: FC<{ editor: Editor; active: boolean }> = ({ editor, active }) => {
  const requested = useUIStore(state => state.findRequested)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [index, setIndex] = useState(0)
  const [revision, setRevision] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const update = (): void => setRevision(current => current + 1)
    editor.on('update', update)
    return () => {
      editor.off('update', update)
    }
  }, [editor])
  useEffect(() => {
    if (requested && active) {
      setOpen(true)
      useUIStore.getState().setFindRequested(false)
      requestAnimationFrame(() => {
        input.current?.focus()
        input.current?.select()
      })
    }
  }, [requested, active])
  const matches = useMemo(() => {
    void revision
    return findRichText(editor.state.doc, query, matchCase)
  }, [editor, query, matchCase, revision])
  const select = (next: number): void => {
    if (!matches.length) {
      return
    }
    const normalized = (next + matches.length) % matches.length
    const match = matches[normalized]
    if (match) {
      setIndex(normalized)
      editor.chain().setTextSelection(match).scrollIntoView().run()
    }
  }
  useEffect(() => {
    setIndex(0)
    const match = matches[0]
    if (open && active && match) {
      editor.chain().setTextSelection(match).scrollIntoView().run()
    }
  }, [matches, open, active, editor])
  if (!open || !active) {
    return null
  }
  return (
    <form
      aria-label="Find in Write"
      className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface-raised p-2 text-xs"
      onSubmit={event => {
        event.preventDefault()
        select(index + 1)
      }}
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          setOpen(false)
          editor.commands.focus()
        }
      }}
    >
      <input
        ref={input}
        aria-label="Find text"
        placeholder="Find in document"
        maxLength={1000}
        className="connection-input w-36"
        value={query}
        onChange={event => setQuery(event.target.value)}
      />
      <span role="status">
        {matches.length
          ? `${Math.min(index + 1, matches.length)} of ${matches.length}${matches.length === 500 ? '+' : ''}`
          : 'No matches'}
      </span>
      {matches.length === 500 && (
        <span className="text-text-secondary">
          First 500 matches. Narrow the search to replace all.
        </span>
      )}
      <button
        type="button"
        className="secondary-action"
        disabled={!matches.length}
        onClick={() => select(index - 1)}
      >
        Previous match
      </button>
      <button type="submit" className="secondary-action" disabled={!matches.length}>
        Next match
      </button>
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          checked={matchCase}
          onChange={event => setMatchCase(event.target.checked)}
        />
        Match case
      </label>
      <input
        aria-label="Replace with"
        placeholder="Replace with"
        className="connection-input w-32"
        value={replacement}
        onChange={event => setReplacement(event.target.value)}
      />
      <button
        type="button"
        className="secondary-action"
        disabled={!matches.length}
        onClick={() => {
          const match = matches[index % matches.length]
          if (match) {
            editor.view.dispatch(
              closeHistory(editor.state.tr).insertText(replacement, match.from, match.to)
            )
          }
        }}
      >
        Replace match
      </button>
      <button
        type="button"
        className="secondary-action"
        disabled={!matches.length || matches.length === 500}
        onClick={() => {
          const transaction = closeHistory(editor.state.tr)
          for (const match of [...matches].reverse()) {
            transaction.insertText(replacement, match.from, match.to)
          }
          editor.view.dispatch(transaction)
        }}
      >
        Replace all
      </button>
      <button
        type="button"
        className="secondary-action"
        onClick={() => {
          setOpen(false)
          editor.commands.focus()
        }}
      >
        Close find
      </button>
    </form>
  )
}
