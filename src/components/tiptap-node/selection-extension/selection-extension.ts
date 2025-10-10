"use client"

import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

export interface SelectionExtensionOptions {
  /**
   * CSS class for the selection decoration
   * @default "selection"
   */
  className: string
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    selection: {
      /**
       * Set selection decoration
       */
      setSelection: () => ReturnType
    }
  }
}

/**
 * Selection extension that provides better text selection behavior
 * Based on the official Tiptap Simple Editor template
 */
export const SelectionExtension = Extension.create<SelectionExtensionOptions>({
  name: "selection",

  addOptions() {
    return {
      className: "selection",
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("selection"),
        props: {
          decorations: (state) => {
            const { selection } = state
            const { from, to } = selection

            if (from === to) {
              return DecorationSet.empty
            }

            const decorations = [
              Decoration.inline(from, to, {
                class: this.options.className,
              }),
            ]

            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },

  addCommands() {
    return {
      setSelection:
        () =>
        ({ commands }) => {
          return commands.focus()
        },
    }
  },
})

export default SelectionExtension