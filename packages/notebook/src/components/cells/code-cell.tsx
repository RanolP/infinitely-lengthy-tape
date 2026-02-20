import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { HoverEntry } from '@edhit/editor-core';
import { SemanticHighlight, semanticHighlightKey, buildLineMap, offsetToPmPos, pmPosToOffset } from '../../extensions/semantic-highlight.js';
import { EdhitKeymap } from '../../extensions/edhit-keymap.js';
import { CompletionMenu } from '../completion/completion-menu.js';
import { CellHandle } from './cell-handle.js';
import { CellOutput } from './cell-output.js';
import { useCompletion } from '../../hooks/use-completion.js';
import { useNotebookContext } from '../../context/notebook-context.js';
import { useEffectEvent } from '../../hooks/use-effect-event.js';
import type { Editor as TiptapEditor } from '@tiptap/core';

export interface CodeCellProps {
  cellId: string;
  initialContent?: string;
  isFocused: boolean;
}

function findHoverEntry(entries: HoverEntry[], offset: number): HoverEntry | null {
  let best: HoverEntry | null = null;
  let bestSize = Infinity;
  for (const entry of entries) {
    if (offset >= entry.span.start.offset && offset <= entry.span.end.offset) {
      const size = entry.span.end.offset - entry.span.start.offset;
      if (size < bestSize) {
        best = entry;
        bestSize = size;
      }
    }
  }
  return best;
}

function getSourceText(editor: TiptapEditor): string {
  const doc = editor.state.doc;
  const lines: string[] = [];
  doc.forEach((node) => {
    lines.push(node.textContent);
  });
  return lines.join('\n');
}

export function CodeCell({ cellId, initialContent, isFocused }: CodeCellProps) {
  const ctx = useNotebookContext();

  // Derive per-cell values from context
  const cellIndex = ctx.cells.findIndex((c) => c.id === cellId);
  const isFirst = cellIndex === 0;
  const isLast = cellIndex === ctx.cells.length - 1;
  const isSingle = ctx.cells.length === 1;
  const cellSlice = ctx.cellResults.get(cellId) ?? null;
  const mapEntry = ctx.offsetMap.find((e) => e.cellId === cellId);
  const cellGlobalOffset = mapEntry?.globalStart ?? 0;

  const [hoverOffset, setHoverOffset] = useState<number | null>(null);
  const completionKeyRef = useRef<((key: string) => boolean) | null>(null);

  // Stable callbacks for tiptap — always see latest context values
  const handleContentChange = useEffectEvent((content: string) => {
    ctx.setCellContent(cellId, content);
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

  const initialHtml = initialContent
    ? initialContent
        .split('\n')
        .map((line) => `<p>${line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') || '<br>'}</p>`)
        .join('')
    : undefined;

  const editor = useEditor({
    content: initialHtml,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editable: !ctx.readOnly,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bulletList: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        listItem: false,
        orderedList: false,
        bold: false,
        italic: false,
        code: false,
        strike: false,
        hardBreak: false,
        dropcursor: false,
        gapcursor: false,
      }),
      SemanticHighlight,
      EdhitKeymap.configure({
        onNavigateUp: handleNavigateUp,
        onNavigateDown: handleNavigateDown,
      }),
      Placeholder.configure({
        placeholder: 'Write code here...',
      }),
    ],
    onUpdate: ({ editor: ed }) => {
      handleContentChange(getSourceText(ed));
    },
    onFocus: handleFocus,
    editorProps: {
      attributes: {
        class: 'tiptap-editor tiptap-code-cell',
        spellcheck: 'false',
        autocorrect: 'off',
        autocapitalize: 'off',
        'data-gramm': 'false',
        'data-gramm_editor': 'false',
        'data-enable-grammarly': 'false',
      },
      handleKeyDown: (_view, event) => {
        const handler = completionKeyRef.current;
        if (handler) {
          return handler(event.key);
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (isFocused && editor && !editor.isFocused) {
      editor.commands.focus('end');
    }
  }, [isFocused, editor]);

  const completion = useCompletion(editor, ctx.globalAnalysis, cellGlobalOffset);

  useEffect(() => {
    if (!completion.isOpen) {
      completionKeyRef.current = null;
      return;
    }
    completionKeyRef.current = (key: string) => {
      if (key === 'ArrowDown') {
        completion.moveSelection(1);
        return true;
      }
      if (key === 'ArrowUp') {
        completion.moveSelection(-1);
        return true;
      }
      if (key === 'Enter' || key === 'Tab') {
        completion.accept();
        return true;
      }
      if (key === 'Escape') {
        completion.dismiss();
        return true;
      }
      return false;
    };
  }, [completion.isOpen, completion.accept, completion.dismiss, completion.moveSelection]);

  useEffect(() => {
    if (!editor || !cellSlice) return;

    const source = getSourceText(editor);
    const lineMap = buildLineMap(source);
    const decos: Decoration[] = [];

    for (const token of cellSlice.semanticTokens) {
      const from = offsetToPmPos(lineMap, token.offset);
      const to = offsetToPmPos(lineMap, token.offset + token.length);
      if (from < to) {
        decos.push(Decoration.inline(from, to, { class: `sem-${token.kind}` }));
      }
    }

    for (const err of cellSlice.parseErrors) {
      const from = offsetToPmPos(lineMap, err.pos.offset);
      let endOffset = err.pos.offset;
      while (endOffset < source.length && source[endOffset] !== '\n') {
        endOffset++;
      }
      if (endOffset === err.pos.offset) endOffset = Math.min(err.pos.offset + 1, source.length);
      const to = offsetToPmPos(lineMap, endOffset);
      if (from < to) {
        decos.push(Decoration.inline(from, to, { class: 'sem-parse-error', title: err.message }));
      }
    }

    for (const err of cellSlice.typeErrors) {
      const from = offsetToPmPos(lineMap, err.span.start.offset);
      const to = offsetToPmPos(lineMap, err.span.end.offset);
      if (from < to) {
        decos.push(Decoration.inline(from, to, { class: 'sem-error', title: err.message }));
      }
    }

    const decoSet = DecorationSet.create(editor.state.doc, decos);
    const tr = editor.state.tr.setMeta(semanticHighlightKey, decoSet);
    editor.view.dispatch(tr);
  }, [editor, cellSlice]);

  const hoveredExpr = useMemo(() => {
    if (hoverOffset === null || !cellSlice) return null;
    const entry = findHoverEntry(cellSlice.hoverEntries, hoverOffset);
    if (!entry) return null;
    if (!editor) return null;
    const source = getSourceText(editor);
    const text = source.slice(entry.span.start.offset, entry.span.end.offset);
    return { text, type: entry.type };
  }, [hoverOffset, cellSlice, editor]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!editor) return;
      const coords = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
      if (!coords) {
        setHoverOffset(null);
        return;
      }
      const source = getSourceText(editor);
      const lineMap = buildLineMap(source);
      setHoverOffset(pmPosToOffset(lineMap, coords.pos));
    },
    [editor],
  );

  const handleMouseLeave = useCallback(() => {
    setHoverOffset(null);
  }, []);

  const status = cellSlice?.status ?? 'stale';

  return (
    <div className={`notebook-cell-row ${isFocused ? 'notebook-cell-row-focused' : ''}`}>
      {!ctx.readOnly && (
        <CellHandle
          cellType="code"
          status={status}
          isFirst={isFirst}
          isLast={isLast}
          isSingle={isSingle}
          onChangeType={(type) => ctx.setCellType(cellId, type)}
          onRun={ctx.runAnalysisNow}
          onMoveUp={() => ctx.moveCellUp(cellId)}
          onMoveDown={() => ctx.moveCellDown(cellId)}
          onDelete={() => ctx.deleteCell(cellId)}
        />
      )}
      <div className={`notebook-cell notebook-cell-code ${isFocused ? 'notebook-cell-focused' : ''}`}>
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
          <EditorContent editor={editor} />
        </div>
        {!ctx.readOnly && completion.isOpen && (
          <CompletionMenu
            items={completion.items}
            selectedIndex={completion.selectedIndex}
            coords={completion.coords}
            onAccept={completion.accept}
            onDismiss={completion.dismiss}
          />
        )}
        <CellOutput slice={cellSlice} hover={hoveredExpr} />
      </div>
    </div>
  );
}
