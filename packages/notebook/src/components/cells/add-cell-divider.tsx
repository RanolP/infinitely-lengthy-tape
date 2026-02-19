interface AddCellDividerProps {
  onAddCode: () => void;
  onAddProse: () => void;
}

export function AddCellDivider({ onAddCode, onAddProse }: AddCellDividerProps) {
  return (
    <div className="add-cell-divider">
      <div className="add-cell-line" />
      <div className="add-cell-buttons">
        <button
          type="button"
          onClick={onAddCode}
          className="rounded bg-neutral-700 px-2 py-0.5 text-xs text-neutral-400 hover:bg-neutral-600 hover:text-white"
        >
          + Code
        </button>
        <button
          type="button"
          onClick={onAddProse}
          className="rounded bg-neutral-700 px-2 py-0.5 text-xs text-neutral-400 hover:bg-neutral-600 hover:text-white"
        >
          + Prose
        </button>
      </div>
    </div>
  );
}
