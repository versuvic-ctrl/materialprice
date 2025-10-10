"use client"

import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Node as ProseMirrorNode } from "@tiptap/pm/model"

export interface TrailingNodeExtensionOptions {
  /**
   * Node type to insert at the end
   * @default "paragraph"
   */
  node: string
  /**
   * Node types after which to insert the trailing node
   * @default ["heading", "codeBlock", "blockquote"]
   */
  notAfter: string[]
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    trailingNode: {
      /**
       * Insert trailing node
       */
      insertTrailingNode: () => ReturnType
    }
  }
}

/**
 * Trailing node extension that ensures there's always a paragraph at the end
 * Based on the official Tiptap Simple Editor template
 */
export const TrailingNodeExtension = Extension.create<TrailingNodeExtensionOptions>({
  name: "trailingNode",

  addOptions() {
    return {
      node: "paragraph",
      notAfter: ["heading", "codeBlock", "blockquote"],
    }
  },

  addProseMirrorPlugins() {
    const plugin = new Plugin({
      key: new PluginKey("trailingNode"),
      appendTransaction: (_, __, newState) => {
        const { doc, tr } = newState
        const shouldInsertNodeAtEnd = plugin.getState(newState)
        const endPosition = doc.content.size
        const type = newState.schema.nodes[this.options.node]

        if (!shouldInsertNodeAtEnd) {
          return
        }

        return tr.insert(endPosition, type.create())
      },
      state: {
        init: (_, state) => {
          const lastNode = state.doc.lastChild
          return !this.options.notAfter.includes(lastNode?.type.name || "")
        },
        apply: (tr, value) => {
          if (!tr.docChanged) {
            return value
          }

          const lastNode = tr.doc.lastChild
          return !this.options.notAfter.includes(lastNode?.type.name || "")
        },
      },
    })

    return [plugin]
  },

  addCommands() {
    return {
      insertTrailingNode:
        () =>
        ({ commands }) => {
          const { doc } = this.editor.state
          const type = this.editor.schema.nodes[this.options.node]
          
          if (type) {
            return commands.insertContentAt(doc.content.size, type.create())
          }
          
          return false
        },
    }
  },
})

export default TrailingNodeExtension