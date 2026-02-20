import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { EdhitKeymap } from '../../extensions/edhit-keymap.js';
import { TypstEditorExtension } from '../../extensions/typst-editor-extension.js';
import { CellHandle } from './cell-handle.js';
import { useNotebookContext } from '../../context/notebook-context.js';
import { useEffectEvent } from '../../hooks/use-effect-event.js';

export interface ProseCellProps {
  cellId: string;
  initialContent?: string;
  isFocused: boolean;
}

export function ProseCell({ cellId, initialContent, isFocused }: ProseCellProps) {
  const ctx = useNotebookContext();

  // Derive per-cell values from context
  const cellIndex = ctx.cells.findIndex((c) => c.id === cellId);
  const isFirst = cellIndex === 0;
  const isLast = cellIndex === ctx.cells.length - 1;
  const isSingle = ctx.cells.length === 1;

  // Stable callbacks for tiptap — always see latest context values
  const handleContentChange = useEffectEvent((html: string) => {
    ctx.setCellContent(cellId, html);
  });
  const handleFocus = useEffectEvent(() => {
    ctx.setFocusedCellId(cellId);
  });
  const handleNavigateUp = useEffectEvent(() => {
    if (cellIndex > 0) ctx.setFocusedCellId(ctx.cells[cellIndex - 1]!.id);
  });
  const handleNavigateDown = useEffectEvent(() => {
    if (cellIndex < ctx.cells.length - 1) ctx.setFocusedCellId(ctx.cells[cellIndex + 1]!.id);
  });

  const editor = useEditor({
    content: initialContent || undefined,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editable: !ctx.readOnly,
    extensions: [
      StarterKit.configure({
        dropcursor: false,
        gapcursor: false,
        link: {
          openOnClick: false,
          HTMLAttributes: {
            target: '_blank',
            rel: 'noopener noreferrer',
          },
        },
      }),
      EdhitKeymap.configure({
        onNavigateUp: handleNavigateUp,
        onNavigateDown: handleNavigateDown,
      }),
      TypstEditorExtension,
      Placeholder.configure({
        placeholder: 'Write notes here...',
      }),
    ],
    onUpdate: ({ editor: ed }) => {
      handleContentChange(ed.getHTML());
    },
    onFocus: handleFocus,
    editorProps: {
      attributes: {
        class: 'tiptap-editor tiptap-prose-cell',
        spellcheck: 'true',
      },
    },
  });

  useEffect(() => {
    if (isFocused && editor && !editor.isFocused) {
      editor.commands.focus('end');
    }
  }, [isFocused, editor]);

  return (
    <div className={`notebook-cell-row ${isFocused ? 'notebook-cell-row-focused' : ''}`}>
      {!ctx.readOnly && (
        <CellHandle
          cellType="prose"
          status="ok"
          isFirst={isFirst}
          isLast={isLast}
          isSingle={isSingle}
          onChangeType={(type) => ctx.setCellType(cellId, type)}
          onMoveUp={() => ctx.moveCellUp(cellId)}
          onMoveDown={() => ctx.moveCellDown(cellId)}
          onDelete={() => ctx.deleteCell(cellId)}
        />
      )}
      <div className="notebook-cell notebook-cell-prose">
        {editor && (
          <BubbleMenu
            editor={editor}
            appendTo={() => document.body}
            options={{
              strategy: 'fixed',
              placement: 'top',
            }}
            shouldShow={({ editor: ed, state, from, to }) => {
              if (!ed.isEditable || !ed.isFocused) return false;
              const selection = state.selection;
              if (selection.empty) return false;
              return state.doc.textBetween(from, to).trim().length > 0;
            }}
          >
            <div className="bubble-menu">
              <button
                type="button"
                className={`bubble-menu-btn ${editor.isActive('bold') ? 'bubble-menu-btn-active' : ''}`}
                onClick={() => editor.chain().focus().toggleBold().run()}
              >
                <strong>B</strong>
              </button>
              <button
                type="button"
                className={`bubble-menu-btn ${editor.isActive('italic') ? 'bubble-menu-btn-active' : ''}`}
                onClick={() => editor.chain().focus().toggleItalic().run()}
              >
                <em>I</em>
              </button>
            </div>
          </BubbleMenu>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
