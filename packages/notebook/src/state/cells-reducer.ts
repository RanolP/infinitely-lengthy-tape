import type { Cell, CellType } from '../model/types.js';

export type CellAction =
  | { type: 'add'; afterId: string | null; cellType: CellType }
  | { type: 'delete'; id: string }
  | { type: 'setContent'; id: string; content: string }
  | { type: 'setType'; id: string; cellType: CellType }
  | { type: 'moveUp'; id: string }
  | { type: 'moveDown'; id: string }
  | { type: 'reset'; cells: Cell[] };

function createCell(cellType: CellType): Cell {
  return { id: crypto.randomUUID(), type: cellType, content: '' };
}

export function cellsReducer(state: Cell[], action: CellAction): Cell[] {
  switch (action.type) {
    case 'add': {
      const newCell = createCell(action.cellType);
      if (action.afterId === null) return [newCell, ...state];
      const idx = state.findIndex((c) => c.id === action.afterId);
      if (idx === -1) return [...state, newCell];
      return [...state.slice(0, idx + 1), newCell, ...state.slice(idx + 1)];
    }

    case 'delete': {
      if (state.length <= 1) return state;
      const idx = state.findIndex((c) => c.id === action.id);
      if (idx === -1) return state;
      return [...state.slice(0, idx), ...state.slice(idx + 1)];
    }

    case 'setContent': {
      const idx = state.findIndex((c) => c.id === action.id);
      if (idx === -1) return state;
      if (state[idx]!.content === action.content) return state;
      const next = state.slice();
      next[idx] = { ...state[idx]!, content: action.content };
      return next;
    }

    case 'setType': {
      const idx = state.findIndex((c) => c.id === action.id);
      if (idx === -1) return state;
      if (state[idx]!.type === action.cellType) return state;
      const next = state.slice();
      next[idx] = { ...state[idx]!, type: action.cellType, content: '' };
      return next;
    }

    case 'moveUp': {
      const idx = state.findIndex((c) => c.id === action.id);
      if (idx <= 0) return state;
      const next = state.slice();
      next[idx - 1] = state[idx]!;
      next[idx] = state[idx - 1]!;
      return next;
    }

    case 'moveDown': {
      const idx = state.findIndex((c) => c.id === action.id);
      if (idx === -1 || idx >= state.length - 1) return state;
      const next = state.slice();
      next[idx] = state[idx + 1]!;
      next[idx + 1] = state[idx]!;
      return next;
    }

    case 'reset':
      return action.cells;
  }
}
