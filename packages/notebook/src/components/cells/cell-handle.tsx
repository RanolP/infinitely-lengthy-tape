import { useState, useRef, useEffect, useCallback } from 'react';
import type { CellType, CellStatus } from '../../model/types.js';

interface CellHandleProps {
  cellType: CellType;
  status: CellStatus;
  isFirst: boolean;
  isLast: boolean;
  isSingle: boolean;
  onChangeType: (type: CellType) => void;
  onRun?: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

const statusColor: Record<CellStatus, string> = {
  ok: '#22c55e',
  error: '#ef4444',
  stale: '#eab308',
};

export function CellHandle({
  cellType,
  status,
  isFirst,
  isLast,
  isSingle,
  onChangeType,
  onRun,
  onMoveUp,
  onMoveDown,
  onDelete,
}: CellHandleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const act = useCallback((fn: () => void) => {
    return () => { fn(); setMenuOpen(false); };
  }, []);

  return (
    <div className="cell-handle-container">
      <button
        ref={btnRef}
        type="button"
        className="cell-handle"
        onClick={() => setMenuOpen(!menuOpen)}
        draggable
        title="Drag to reorder, click for options"
      >
        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
          <circle cx="3" cy="3" r="1.5" />
          <circle cx="7" cy="3" r="1.5" />
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="7" cy="8" r="1.5" />
          <circle cx="3" cy="13" r="1.5" />
          <circle cx="7" cy="13" r="1.5" />
        </svg>
      </button>
      {cellType === 'code' && (
        <span
          className="cell-handle-status"
          style={{ background: statusColor[status] }}
        />
      )}
      {menuOpen && (
        <div ref={menuRef} className="cell-handle-menu">
          <button type="button" className="cell-handle-menu-item" onClick={act(() => onChangeType(cellType === 'code' ? 'prose' : 'code'))}>
            Convert to {cellType === 'code' ? 'Prose' : 'Code'}
          </button>
          {cellType === 'code' && onRun && (
            <button type="button" className="cell-handle-menu-item" onClick={act(onRun)}>
              Run
            </button>
          )}
          <div className="cell-handle-menu-sep" />
          <button type="button" className="cell-handle-menu-item" onClick={act(onMoveUp)} disabled={isFirst}>
            Move up
          </button>
          <button type="button" className="cell-handle-menu-item" onClick={act(onMoveDown)} disabled={isLast}>
            Move down
          </button>
          <div className="cell-handle-menu-sep" />
          <button type="button" className="cell-handle-menu-item cell-handle-menu-danger" onClick={act(onDelete)} disabled={isSingle}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
