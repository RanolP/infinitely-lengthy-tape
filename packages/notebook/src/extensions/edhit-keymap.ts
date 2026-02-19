import { Extension } from '@tiptap/core';

export interface EdhitKeymapOptions {
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
}

export const EdhitKeymap = Extension.create<EdhitKeymapOptions>({
  name: 'edhitKeymap',

  addOptions() {
    return {
      onNavigateUp: undefined,
      onNavigateDown: undefined,
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        this.editor.commands.insertContent('  ');
        return true;
      },
      'Shift-Tab': () => true,
      Enter: ({ editor }) => {
        const { $from } = editor.state.selection;
        const textContent = $from.parent.textContent;
        const indent = textContent.match(/^\s*/)?.[0] ?? '';
        editor.commands.splitBlock();
        if (indent) {
          editor.commands.insertContent(indent);
        }
        return true;
      },
      'Shift-Enter': ({ editor }) => {
        editor.commands.splitBlock();
        return true;
      },
      ArrowUp: ({ editor }) => {
        if (!this.options.onNavigateUp) return false;
        const { $from } = editor.state.selection;
        const isFirstBlock = $from.index($from.depth - 1) === 0;
        const isAtStart = $from.parentOffset === 0;
        if (isFirstBlock && isAtStart) {
          this.options.onNavigateUp();
          return true;
        }
        const coords = editor.view.coordsAtPos($from.pos);
        const startCoords = editor.view.coordsAtPos($from.start());
        if (coords && startCoords && coords.top <= startCoords.top) {
          this.options.onNavigateUp();
          return true;
        }
        return false;
      },
      ArrowDown: ({ editor }) => {
        if (!this.options.onNavigateDown) return false;
        const { $from } = editor.state.selection;
        const parentIndex = $from.index($from.depth - 1);
        const parentChildCount = $from.node($from.depth - 1).childCount;
        const isLastBlock = parentIndex === parentChildCount - 1;
        const isAtEnd = $from.parentOffset === $from.parent.content.size;
        if (isLastBlock && isAtEnd) {
          this.options.onNavigateDown();
          return true;
        }
        const coords = editor.view.coordsAtPos($from.pos);
        const endCoords = editor.view.coordsAtPos($from.end());
        if (coords && endCoords && coords.bottom >= endCoords.bottom) {
          this.options.onNavigateDown();
          return true;
        }
        return false;
      },
    };
  },
});
