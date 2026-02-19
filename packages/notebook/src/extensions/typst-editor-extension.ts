import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { TypstNodeView } from '../typst/typst-node-view.js';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    typstInline: {
      insertTypstInline: () => ReturnType;
    };
  }
}

export const TypstEditorExtension = Node.create({
  name: 'typstInline',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      source: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-typst-source') ?? '',
        renderHTML: (attributes) =>
          attributes.source ? { 'data-typst-source': String(attributes.source) } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-typst-inline]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-typst-inline': '' })];
  },

  addCommands() {
    return {
      insertTypstInline:
        () =>
        ({ commands, state }) => {
          const pos = state.selection.from;
          const inserted = commands.insertContentAt(pos, { type: this.name, attrs: { source: '' } });
          if (!inserted) return false;
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      $: () => this.editor.commands.insertTypstInline(),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(TypstNodeView, {
      stopEvent: ({ event }) => {
        if (!(event.target instanceof HTMLElement)) return false;
        const inTypstNode = event.target.closest('.typst-inline-node');
        if (!inTypstNode) return false;

        // Follow Tiptap node-view pattern for interactive controls:
        // keep editor keymap/selection handlers away from the inner input only.
        return Boolean(
          event.target.closest('input,textarea,select,button,[contenteditable="true"]'),
        );
      },
      ignoreMutation: ({ mutation }) => {
        if (!(mutation.target instanceof HTMLElement)) return false;
        return Boolean(mutation.target.closest('.typst-inline-node'));
      },
    });
  },
});
