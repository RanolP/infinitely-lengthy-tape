import { useReducer, useCallback } from 'react';
import { cellsReducer, type CellAction } from '../state/cells-reducer.js';
import type { Cell, CellType } from '../model/types.js';

export interface NotebookCellsState {
  cells: Cell[];
  dispatch: React.Dispatch<CellAction>;
  addCell: (afterId: string | null, type: CellType) => void;
  deleteCell: (id: string) => void;
  setCellContent: (id: string, content: string) => void;
  setCellType: (id: string, cellType: CellType) => void;
  moveCellUp: (id: string) => void;
  moveCellDown: (id: string) => void;
  resetCells: (cells: Cell[]) => void;
}

function createInitialCell(): Cell[] {
  return [{ id: crypto.randomUUID(), type: 'code', content: '' }];
}

export function useNotebookCells(): NotebookCellsState {
  const [cells, dispatch] = useReducer(cellsReducer, undefined, createInitialCell);

  const addCell = useCallback(
    (afterId: string | null, type: CellType) => dispatch({ type: 'add', afterId, cellType: type }),
    [],
  );

  const deleteCell = useCallback(
    (id: string) => dispatch({ type: 'delete', id }),
    [],
  );

  const setCellContent = useCallback(
    (id: string, content: string) => dispatch({ type: 'setContent', id, content }),
    [],
  );

  const setCellType = useCallback(
    (id: string, cellType: CellType) => dispatch({ type: 'setType', id, cellType }),
    [],
  );

  const moveCellUp = useCallback(
    (id: string) => dispatch({ type: 'moveUp', id }),
    [],
  );

  const moveCellDown = useCallback(
    (id: string) => dispatch({ type: 'moveDown', id }),
    [],
  );

  const resetCells = useCallback(
    (cells: Cell[]) => dispatch({ type: 'reset', cells }),
    [],
  );

  return {
    cells,
    dispatch,
    addCell,
    deleteCell,
    setCellContent,
    setCellType,
    moveCellUp,
    moveCellDown,
    resetCells,
  };
}
