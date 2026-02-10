import { Extension } from '@tiptap/core';

export const EdhitKeymap = Extension.create({
  name: 'edhitKeymap',

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        this.editor.commands.insertContent('  ');
        return true;
      },
      'Shift-Tab': () => true,
      'Mod-b': () => true,
      'Mod-i': () => true,
      'Mod-u': () => true,
      'Shift-Enter': ({ editor }) => {
        editor.commands.splitBlock();
        return true;
      },
    };
  },
});
