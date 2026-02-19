import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type DragEvent,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { renderTypst } from './typst.js';

export function TypstNodeView(props: NodeViewProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const renderRequestId = useRef(0);
  const persistedSource = ((props.node.attrs.source as string) ?? '').trim();
  const [isEditing, setIsEditing] = useState(!(props.node.attrs.source as string));
  const [source, setSource] = useState((props.node.attrs.source as string) ?? '');
  const [lastRendered, setLastRendered] = useState<string>('');
  const [isRendering, setIsRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const copyText = persistedSource.startsWith('$') && persistedSource.endsWith('$')
    ? persistedSource.slice(1, -1).trim()
    : persistedSource;

  useEffect(() => {
    if (isEditing) return;
    const nextSource = (props.node.attrs.source as string) ?? '';
    setSource(nextSource);
  }, [isEditing, props.node.attrs.source]);

  useEffect(() => {
    if (!isEditing) return;
    const focusInput = () => {
      const input = inputRef.current;
      if (!input) return;
      if (document.activeElement !== input) {
        input.focus();
      }
      input.select();
    };

    // ProseMirror transaction after node insertion can steal focus back.
    // Retry on next ticks so newly inserted Typst node enters typing mode immediately.
    const t0 = window.setTimeout(focusInput, 0);
    const t1 = window.setTimeout(focusInput, 32);

    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
    };
  }, [isEditing]);

  const requestRender = (raw: string, debounceMs = 0) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      setLastRendered('');
      setRenderError(null);
      setIsRendering(false);
      return () => {};
    }

    const requestId = ++renderRequestId.current;
    const run = () => {
      setIsRendering(true);
      void renderTypst(trimmed)
        .then((rendered) => {
          if (requestId !== renderRequestId.current) return;
          setLastRendered(rendered);
          setRenderError(null);
        })
        .catch((error) => {
          if (requestId !== renderRequestId.current) return;
          const message = error instanceof Error ? error.message : 'Typst render failed';
          console.warn('[typst-inline] render failed:', message);
          setRenderError(message);
        })
        .finally(() => {
          if (requestId !== renderRequestId.current) return;
          setIsRendering(false);
        });
    };

    const timer = window.setTimeout(run, debounceMs);
    return () => window.clearTimeout(timer);
  };

  useEffect(() => {
    if (isEditing) {
      return requestRender(source, 120);
    }
    return requestRender(persistedSource, 0);
  }, [isEditing, persistedSource, source]);

  const moveCaretAfterNode = () => {
    if (typeof props.getPos !== 'function') return;
    const pos = props.getPos();
    if (pos === undefined) return;
    props.editor.chain().focus().setTextSelection(pos + props.node.nodeSize).run();
  };

  const commitAndClose = () => {
    const trimmed = source.trim();
    if (!trimmed) {
      props.deleteNode();
      return;
    }
    requestRender(trimmed, 0);
    setSource(trimmed);
    props.updateAttributes({ source: trimmed });
    setIsEditing(false);
    moveCaretAfterNode();
  };

  return (
    <NodeViewWrapper
      as="span"
      className={`typst-inline-node ${isEditing ? 'typst-inline-node-editing' : ''}`}
      data-typst-inline=""
      contentEditable={false}
      draggable={!isEditing}
      data-drag-handle={false}
      onClick={(event: MouseEvent) => {
        if (isEditing || !props.editor.isEditable) return;
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        setIsEditing(true);
      }}
      onDoubleClick={(event: MouseEvent) => {
        event.stopPropagation();
        setIsEditing(true);
      }}
      onCopy={(event: ClipboardEvent) => {
        if (isEditing || !copyText) return;
        event.preventDefault();
        event.stopPropagation();
        event.clipboardData.setData('text/plain', copyText);
      }}
      onDragStart={(event: DragEvent) => {
        if (isEditing || !copyText) return;
        event.dataTransfer.setData('text/plain', copyText);
      }}
    >
      {isEditing ? (
        <span className="typst-inline-editor">
          <input
            ref={inputRef}
            type="text"
            className="typst-inline-input"
            value={source}
            placeholder="Typst math"
            onMouseDown={(event: MouseEvent<HTMLInputElement>) => event.stopPropagation()}
            onFocus={(event: FocusEvent<HTMLInputElement>) => event.stopPropagation()}
            onChange={(event) => {
              const next = event.target.value;
              setSource(next);
            }}
            onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
              event.stopPropagation();
              if (event.key === 'Enter' || event.key === 'Tab') {
                event.preventDefault();
                commitAndClose();
                return;
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                setSource((props.node.attrs.source as string) ?? '');
                setIsEditing(false);
                moveCaretAfterNode();
              }
            }}
            onBlur={(event: FocusEvent<HTMLInputElement>) => {
              event.stopPropagation();
              commitAndClose();
            }}
          />
          {renderError && <span className="typst-inline-error">⚠</span>}
          {isRendering && <span className="typst-inline-rendering">…</span>}
        </span>
      ) : (
        <span className="typst-inline-render">
          {lastRendered ? (
            // eslint-disable-next-line react/no-danger
            <span dangerouslySetInnerHTML={{ __html: lastRendered }} />
          ) : persistedSource ? (
            <span className="typst-render-fallback">{persistedSource}</span>
          ) : (
            <span className="typst-inline-placeholder">$?$</span>
          )}
        </span>
      )}
    </NodeViewWrapper>
  );
}
