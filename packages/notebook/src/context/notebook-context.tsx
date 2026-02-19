import { createContext, useContext } from 'react';
import type { Cell, CellType, CellAnalysisSlice, OffsetMapEntry } from '../model/types.js';
import type { AnalysisResult } from '@edhit/editor-core';

export interface NotebookContextValue {
  cells: Cell[];
  cellResults: Map<string, CellAnalysisSlice>;
  globalAnalysis: AnalysisResult | null;
  offsetMap: OffsetMapEntry[];
  setCellContent: (id: string, content: string) => void;
  setCellType: (id: string, cellType: CellType) => void;
  moveCellUp: (id: string) => void;
  moveCellDown: (id: string) => void;
  deleteCell: (id: string) => void;
  setFocusedCellId: (id: string | null) => void;
  runAnalysisNow: () => void;
  readOnly: boolean;
}

export const NotebookContext = createContext<NotebookContextValue | null>(null);

export function useNotebookContext(): NotebookContextValue {
  const ctx = useContext(NotebookContext);
  if (!ctx) throw new Error('useNotebookContext must be used within NotebookContext.Provider');
  return ctx;
}
