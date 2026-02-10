import { useState, useCallback, useEffect, useRef } from 'react';
import { collectCompletions, collectScopeAtOffset, type CompletionItem, type AnalysisResult } from '@edhit/editor-core';
import { pmPosToOffset, buildLineMap } from '../extensions/SemanticHighlight.js';
import type { Editor } from '@tiptap/core';

export interface CompletionState {
  items: CompletionItem[];
  selectedIndex: number;
  isOpen: boolean;
  coords: { top: number; left: number } | null;
  accept: () => void;
  dismiss: () => void;
  moveSelection: (delta: number) => void;
}

function getWordBeforeCursor(editor: Editor): { word: string; from: number; to: number } | null {
  const { state } = editor;
  const { from } = state.selection;
  const textBefore = state.doc.textBetween(Math.max(0, from - 50), from, '\n');
  // Match word characters (alphanumeric, underscore, dot for styled variants, backslash for lambda)
  const match = textBefore.match(/[\w.\\]+$/);
  if (!match) return null;
  return {
    word: match[0],
    from: from - match[0].length,
    to: from,
  };
}

function getSourceText(editor: Editor): string {
  const doc = editor.state.doc;
  const lines: string[] = [];
  doc.forEach((node) => {
    lines.push(node.textContent);
  });
  return lines.join('\n');
}

export function useCompletion(
  editor: Editor | null,
  analysisResult: AnalysisResult | null,
): CompletionState {
  const [items, setItems] = useState<CompletionItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const wordRef = useRef<{ word: string; from: number; to: number } | null>(null);

  const dismiss = useCallback(() => {
    setIsOpen(false);
    setItems([]);
    setSelectedIndex(0);
    wordRef.current = null;
  }, []);

  const accept = useCallback(() => {
    if (!editor || !wordRef.current || items.length === 0) return;
    const item = items[selectedIndex];
    if (!item) return;

    const { from, to } = wordRef.current;
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        tr.replaceWith(from, to, editor.state.schema.text(item.insertText));
        return true;
      })
      .run();

    dismiss();
  }, [editor, items, selectedIndex, dismiss]);

  const moveSelection = useCallback(
    (delta: number) => {
      setSelectedIndex((prev) => {
        const next = prev + delta;
        if (next < 0) return items.length - 1;
        if (next >= items.length) return 0;
        return next;
      });
    },
    [items.length],
  );

  // Update completions on selection/content changes
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const wordInfo = getWordBeforeCursor(editor);
      if (!wordInfo || wordInfo.word.length < 1) {
        dismiss();
        return;
      }

      wordRef.current = wordInfo;

      // Get scope from analysis result
      const scope =
        analysisResult?.program
          ? (() => {
              const source = getSourceText(editor);
              const lineMap = buildLineMap(source);
              const offset = pmPosToOffset(lineMap, editor.state.selection.from);
              return collectScopeAtOffset(analysisResult.program, offset);
            })()
          : [];

      const completionItems = collectCompletions(wordInfo.word, scope);

      if (completionItems.length === 0) {
        dismiss();
        return;
      }

      setItems(completionItems.slice(0, 20));
      setSelectedIndex(0);
      setIsOpen(true);

      // Get cursor coordinates for positioning
      const cursorCoords = editor.view.coordsAtPos(editor.state.selection.from);
      if (cursorCoords) {
        setCoords({ top: cursorCoords.bottom, left: cursorCoords.left });
      }
    };

    editor.on('selectionUpdate', handleUpdate);
    editor.on('update', handleUpdate);

    return () => {
      editor.off('selectionUpdate', handleUpdate);
      editor.off('update', handleUpdate);
    };
  }, [editor, analysisResult, dismiss]);

  return { items, selectedIndex, isOpen, coords, accept, dismiss, moveSelection };
}
