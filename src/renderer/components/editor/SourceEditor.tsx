import { useEffect, useRef, type FC } from 'react'
import { Compartment, EditorState } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection
} from '@codemirror/view'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
  undo,
  redo,
  undoDepth,
  redoDepth
} from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import {
  defaultHighlightStyle,
  syntaxHighlighting,
  indentUnit,
  bracketMatching
} from '@codemirror/language'
import {
  search,
  searchKeymap,
  openSearchPanel,
  highlightSelectionMatches
} from '@codemirror/search'
import { useEditorStore } from '@/stores/editorStore'
import { oneDark } from '@codemirror/theme-one-dark'
import { useUIStore } from '@/stores/uiStore'
import { publishEditorHistory, subscribeEditorHistory } from '@/lib/editorHistory'

export const SourceEditor: FC = () => {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const preferences = useRef(new Compartment())
  const content = useEditorStore(state => state.content)
  const config = useEditorStore(state => state.config)
  const documentId = useEditorStore(state => state.documentId)
  const theme = useUIStore(state => state.theme)
  const findRequested = useUIStore(state => state.findRequested)

  useEffect(() => {
    if (!host.current) {
      return
    }
    const instance = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: useEditorStore.getState().content,
        extensions: [
          markdown(),
          history(),
          drawSelection(),
          highlightActiveLine(),
          bracketMatching(),
          syntaxHighlighting(defaultHighlightStyle),
          highlightSelectionMatches(),
          search({ top: true }),
          keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
          EditorView.contentAttributes.of({ 'aria-label': 'Markdown source', spellcheck: 'false' }),
          preferences.current.of([]),
          EditorView.updateListener.of(update => {
            publishEditorHistory(undoDepth(update.state) > 0, redoDepth(update.state) > 0)
            if (update.docChanged) {
              useEditorStore.getState().setContent(update.state.doc.toString())
            }
          })
        ]
      })
    })
    view.current = instance
    publishEditorHistory(undoDepth(instance.state) > 0, redoDepth(instance.state) > 0)
    const unsubscribeHistory = subscribeEditorHistory(action => {
      if (action === 'undo') {
        undo(instance)
      } else {
        redo(instance)
      }
      instance.focus()
    })
    const navigate = (event: Event): void => {
      if (!(event instanceof CustomEvent)) {
        return
      }
      const detail: unknown = event.detail
      if (
        typeof detail !== 'object' ||
        detail === null ||
        !('line' in detail) ||
        typeof detail.line !== 'number'
      ) {
        return
      }
      const line = instance.state.doc.line(
        Math.max(1, Math.min(detail.line, instance.state.doc.lines))
      )
      instance.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: 'center' })
      })
      instance.focus()
    }
    window.addEventListener('marka:navigate', navigate)
    return () => {
      window.removeEventListener('marka:navigate', navigate)
      unsubscribeHistory()
      instance.destroy()
      view.current = null
      publishEditorHistory(false, false)
    }
  }, [documentId])

  useEffect(() => {
    if (findRequested && view.current) {
      openSearchPanel(view.current)
      useUIStore.getState().setFindRequested(false)
    }
  }, [findRequested, documentId])

  useEffect(() => {
    const instance = view.current
    if (instance && instance.state.doc.toString() !== content) {
      instance.dispatch({ changes: { from: 0, to: instance.state.doc.length, insert: content } })
    }
  }, [content])

  useEffect(() => {
    const applyPreferences = (): void => {
      const isDark =
        theme === 'dark' ||
        (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      view.current?.dispatch({
        effects: preferences.current.reconfigure([
          ...(isDark ? [oneDark] : []),
          ...(config.showLineNumbers ? [lineNumbers()] : []),
          ...(config.wordWrap ? [EditorView.lineWrapping] : []),
          EditorState.tabSize.of(config.tabSize),
          indentUnit.of(' '.repeat(config.tabSize)),
          EditorView.theme(
            {
              '&': {
                height: '100%',
                color: 'hsl(var(--color-text-primary))',
                backgroundColor: 'hsl(var(--color-surface))'
              },
              '.cm-scroller': {
                overflow: 'auto',
                fontFamily: 'Consolas, "Cascadia Code", "SFMono-Regular", monospace',
                fontSize: `${config.fontSize}px`,
                lineHeight: `${config.lineHeight}`
              },
              '.cm-content': { padding: '20px 0' },
              '.cm-line': { padding: '0 20px' },
              '.cm-gutters': {
                backgroundColor: 'hsl(var(--color-surface-raised))',
                color: 'hsl(var(--color-text-muted))',
                border: 'none'
              },
              '.cm-activeLine, .cm-activeLineGutter': {
                backgroundColor: 'hsl(var(--color-surface-overlay) / 0.6)'
              },
              '.cm-cursor': { borderLeftColor: 'hsl(var(--color-accent))' },
              '.cm-panels': {
                backgroundColor: 'hsl(var(--color-surface-raised))',
                color: 'hsl(var(--color-text-primary))'
              },
              '.cm-textfield, .cm-button': {
                background: 'hsl(var(--color-surface))',
                color: 'hsl(var(--color-text-primary))',
                border: '1px solid hsl(var(--color-border))',
                borderRadius: '4px'
              },
              '&.cm-focused': { outline: 'none' }
            },
            { dark: isDark }
          )
        ])
      })
    }
    applyPreferences()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', applyPreferences)
    return () => {
      media.removeEventListener('change', applyPreferences)
    }
  }, [config, theme, documentId])

  return (
    <section
      aria-label="Source editor"
      className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface"
    >
      <div className="pane-heading">
        <span>Markdown source</span>
        <span>UTF-8</span>
      </div>
      <div ref={host} className="min-h-0 flex-1 overflow-hidden" />
    </section>
  )
}
