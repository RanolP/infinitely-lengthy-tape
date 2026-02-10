import { useRef, useState, useCallback, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { analyze, type AnalysisResult, type ParseErrorInfo, type DefInfo } from '@edhit/editor-core';
import type { TypeError } from '@edhit/language';
import { SemanticHighlight, semanticHighlightKey, buildLineMap, offsetToPmPos, pmPosToOffset } from '../extensions/SemanticHighlight.js';
import { EdhitKeymap } from '../extensions/EdhitKeymap.js';
import { ErrorPanel } from './ErrorPanel.js';
import { ShowPanel } from './ShowPanel.js';
import { CompletionMenu } from './CompletionMenu.js';
import { useCompletion } from '../hooks/useCompletion.js';
import type { Editor as TiptapEditor } from '@tiptap/core';

function findDefAtOffset(defs: DefInfo[], offset: number): DefInfo | null {
  return defs.find((d) => offset >= d.span.start.offset && offset <= d.span.end.offset) ?? null;
}

function getSourceText(editor: TiptapEditor): string {
  const doc = editor.state.doc;
  const lines: string[] = [];
  doc.forEach((node) => {
    lines.push(node.textContent);
  });
  return lines.join('\n');
}

function buildDecorations(editor: TiptapEditor, source: string, result: AnalysisResult): DecorationSet {
  const lineMap = buildLineMap(source);
  const decos: Decoration[] = [];

  for (const token of result.semanticTokens) {
    const from = offsetToPmPos(lineMap, token.offset);
    const to = offsetToPmPos(lineMap, token.offset + token.length);
    if (from < to) {
      decos.push(Decoration.inline(from, to, { class: `sem-${token.kind}` }));
    }
  }

  for (const err of result.parseErrors) {
    const from = offsetToPmPos(lineMap, err.pos.offset);
    let endOffset = err.pos.offset;
    while (endOffset < source.length && source[endOffset] !== '\n') {
      endOffset++;
    }
    if (endOffset === err.pos.offset) endOffset = Math.min(err.pos.offset + 1, source.length);
    const to = offsetToPmPos(lineMap, endOffset);
    if (from < to) {
      decos.push(
        Decoration.inline(from, to, {
          class: 'sem-parse-error',
          title: err.message,
        }),
      );
    }
  }

  for (const err of result.typeErrors) {
    const from = offsetToPmPos(lineMap, err.span.start.offset);
    const to = offsetToPmPos(lineMap, err.span.end.offset);
    if (from < to) {
      decos.push(
        Decoration.inline(from, to, {
          class: 'sem-error',
          title: err.message,
        }),
      );
    }
  }

  return DecorationSet.create(editor.state.doc, decos);
}

export function Editor() {
  const [parseErrors, setParseErrors] = useState<ParseErrorInfo[]>([]);
  const [typeErrors, setTypeErrors] = useState<TypeError[]>([]);
  const [defs, setDefs] = useState<DefInfo[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [hoverOffset, setHoverOffset] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineMapRef = useRef<ReturnType<typeof buildLineMap>>([]);

  const runAnalysis = useCallback(
    (editor: TiptapEditor) => {
      const source = getSourceText(editor);
      const result = analyze(source);
      setAnalysisResult(result);
      setParseErrors(result.parseErrors);
      setTypeErrors(result.typeErrors);
      setDefs(result.defs);

      const lineMap = buildLineMap(source);
      lineMapRef.current = lineMap;

      const decoSet = buildDecorations(editor, source, result);
      const tr = editor.state.tr.setMeta(semanticHighlightKey, decoSet);
      editor.view.dispatch(tr);
    },
    [],
  );

  const editor = useEditor({
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
      EdhitKeymap,
      Placeholder.configure({
        placeholder: 'def Bool := data { .true, .false }',
      }),
    ],
    onUpdate: ({ editor: ed }) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => runAnalysis(ed), 150);
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
        spellcheck: 'false',
        autocorrect: 'off',
        autocapitalize: 'off',
        'data-gramm': 'false',
        'data-gramm_editor': 'false',
        'data-enable-grammarly': 'false',
      },
    },
  });

  const completion = useCompletion(editor, analysisResult);

  const hoveredDef = useMemo(
    () => (hoverOffset !== null ? findDefAtOffset(defs, hoverOffset) : null),
    [defs, hoverOffset],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!editor) return;
      const coords = editor.view.posAtCoords({ left: e.clientX, top: e.clientY });
      if (!coords) {
        setHoverOffset(null);
        return;
      }
      setHoverOffset(pmPosToOffset(lineMapRef.current, coords.pos));
    },
    [editor],
  );

  const handleMouseLeave = useCallback(() => {
    setHoverOffset(null);
  }, []);

  // Handle completion keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!completion.isOpen) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        completion.moveSelection(1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        completion.moveSelection(-1);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        completion.accept();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        completion.dismiss();
      }
    },
    [completion],
  );

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className="rounded-lg border border-neutral-700 bg-neutral-800 p-6"
        onKeyDown={handleKeyDown}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <EditorContent editor={editor} />
      </div>
      {completion.isOpen && (
        <CompletionMenu
          items={completion.items}
          selectedIndex={completion.selectedIndex}
          coords={completion.coords}
          onAccept={completion.accept}
          onDismiss={completion.dismiss}
        />
      )}
      <ShowPanel def={hoveredDef} />
      <ErrorPanel parseErrors={parseErrors} typeErrors={typeErrors} />
    </>
  );
}
