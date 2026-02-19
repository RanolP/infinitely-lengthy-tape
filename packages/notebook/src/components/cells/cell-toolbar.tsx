import type { CellType, CellStatus } from '../../model/types.js';

interface CellToolbarProps {
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

const statusDot: Record<CellStatus, string> = {
  ok: 'bg-green-500',
  error: 'bg-red-500',
  stale: 'bg-yellow-500',
};

export function CellToolbar({
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
}: CellToolbarProps) {
  return (
    <div className="cell-toolbar">
      <select
        value={cellType}
        onChange={(e) => onChangeType(e.target.value as CellType)}
        className="rounded bg-neutral-700 px-2 py-0.5 text-xs text-neutral-300"
      >
        <option value="code">Code</option>
        <option value="prose">Prose</option>
      </select>

      {cellType === 'code' && (
        <>
          <span className={`inline-block h-2 w-2 rounded-full ${statusDot[status]}`} />
          {onRun && (
            <button
              type="button"
              onClick={onRun}
              className="rounded px-2 py-0.5 text-xs text-neutral-400 hover:bg-neutral-600 hover:text-white"
            >
              Run
            </button>
          )}
        </>
      )}

      <div className="flex-1" />

      <button
        type="button"
        onClick={onMoveUp}
        disabled={isFirst}
        className="rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-600 hover:text-white disabled:opacity-30"
      >
        ↑
      </button>
      <button
        type="button"
        onClick={onMoveDown}
        disabled={isLast}
        className="rounded px-1.5 py-0.5 text-xs text-neutral-400 hover:bg-neutral-600 hover:text-white disabled:opacity-30"
      >
        ↓
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={isSingle}
        className="rounded px-1.5 py-0.5 text-xs text-red-400 hover:bg-neutral-600 hover:text-red-300 disabled:opacity-30"
      >
        ×
      </button>
    </div>
  );
}
