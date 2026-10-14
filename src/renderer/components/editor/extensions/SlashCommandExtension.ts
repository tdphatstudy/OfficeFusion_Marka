import { Extension, type Editor, type Range } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { type SuggestionOptions, type SuggestionProps } from '@tiptap/suggestion'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import { SlashCommandMenu, type SlashCommandMenuRef } from '../SlashCommandMenu'
import { slashCommands, type CommandItem } from '../slashCommands'

export const SlashCommandExtension = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({
          editor,
          range,
          props
        }: {
          editor: Editor
          range: Range
          props: CommandItem
        }): void => {
          editor.chain().focus().deleteRange(range).run()
          props.command(editor)
        }
      }
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }: { query: string }): CommandItem[] => {
          const lower = query.toLowerCase()
          return slashCommands.filter(
            item =>
              item.title.toLowerCase().includes(lower) ||
              item.keywords.some(k => k.toLowerCase().includes(lower))
          )
        },
        render: () => {
          let component: ReactRenderer<
            SlashCommandMenuRef,
            { items: CommandItem[]; command: (item: CommandItem) => void }
          >
          let popup: TippyInstance[]

          return {
            onStart: (props: SuggestionProps<CommandItem>): void => {
              component = new ReactRenderer(SlashCommandMenu, {
                props,
                editor: props.editor
              })

              const clientRect = props.clientRect
              if (!clientRect) {
                return
              }

              popup = tippy('body', {
                getReferenceClientRect: clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start'
              })
            },

            onUpdate: (props: SuggestionProps<CommandItem>): void => {
              component.updateProps(props)

              const clientRect = props.clientRect
              if (!clientRect || !popup?.[0]) {
                return
              }

              popup[0].setProps({
                getReferenceClientRect: clientRect as () => DOMRect
              })
            },

            onKeyDown: (props: { event: KeyboardEvent }): boolean => {
              if (props.event.key === 'Escape') {
                popup?.[0]?.hide()
                return true
              }
              return component.ref?.onKeyDown(props) ?? false
            },

            onExit: (): void => {
              popup?.[0]?.destroy()
              component.destroy()
            }
          }
        }
      } as SuggestionOptions<CommandItem>)
    ]
  }
})
