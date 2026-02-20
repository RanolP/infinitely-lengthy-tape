import { useState, useCallback, useEffect, useRef } from 'react';
import { type AnalysisResult } from '@edhit/editor-core';
import {
  useNotebookCells,
  useNotebookAnalysis,
  type Cell,
  type CellType,
  type CellAnalysisSlice,
  type OffsetMapEntry,
} from '@edhit/notebook';
import { fetchFile, saveFile, renameFile, type TapeCell, type TapeFile } from '../../../shared/api/tape-api.js';

export interface PageNotebookState {
  title: string;
  titlePath: string | null;
  cells: Cell[];
  cellResults: Map<string, CellAnalysisSlice>;
  globalAnalysis: AnalysisResult | null;
  offsetMap: OffsetMapEntry[];
  focusedCellId: string | null;
  loading: boolean;
  dirty: boolean;
  setTitle: (title: string) => void;
  renameFileTo: (newFilename: string) => Promise<string | null>;
  addCell: (afterId: string | null, type: CellType) => void;
  deleteCell: (id: string) => void;
  setCellContent: (id: string, content: string) => void;
  setCellType: (id: string, type: CellType) => void;
  moveCellUp: (id: string) => void;
  moveCellDown: (id: string) => void;
  setFocusedCellId: (id: string | null) => void;
  runAnalysisNow: () => void;
}

function createEmptyCell(): Cell {
  return { id: crypto.randomUUID(), type: 'code', content: '' };
}

export function usePageNotebook(
  filePath: string | null,
  onPathChanged?: (newPath: string) => void,
  readOnly = false,
  initialFilePath: string | null = null,
  initialFile: TapeFile | null = null,
): PageNotebookState {
  const {
    cells,
    addCell: rawAddCell,
    deleteCell: rawDeleteCell,
    setCellContent: rawSetCellContent,
    setCellType: rawSetCellType,
    moveCellUp: rawMoveCellUp,
    moveCellDown: rawMoveCellDown,
    resetCells,
  } = useNotebookCells();
  const { cellResults, globalAnalysis, offsetMap, runAnalysisNow } = useNotebookAnalysis(cells);

  const [title, setTitleState] = useState('');
  const [titlePath, setTitlePath] = useState<string | null>(null);
  const [focusedCellId, setFocusedCellId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const usedInitialDataRef = useRef(false);

  // Load file when path changes
  useEffect(() => {
    let cancelled = false;
    const loadFromData = (data: TapeFile, loadedPath: string) => {
      const t = data.title || loadedPath.replace(/\.tape$/, '').split('/').pop() || '';
      setTitleState(t);
      setTitlePath(loadedPath);
      const loaded: Cell[] = data.cells.map((c: TapeCell) => ({
        id: c.id || crypto.randomUUID(),
        type: c.type as CellType,
        content: c.content,
      }));
      if (loaded.length === 0) loaded.push(createEmptyCell());
      resetCells(loaded);
      setDirty(false);
      setLoading(false);
    };

    if (!filePath) {
      setTitleState('');
      setTitlePath(null);
      resetCells([createEmptyCell()]);
      setDirty(false);
      return;
    }

    if (!usedInitialDataRef.current && initialFilePath === filePath && initialFile) {
      usedInitialDataRef.current = true;
      loadFromData(initialFile, filePath);
      return;
    }

    setLoading(true);
    setTitlePath(null);
    fetchFile(filePath)
      .then((data) => {
        if (cancelled) return;
        loadFromData(data, filePath);
      })
      .catch(() => {
        if (cancelled) return;
        setTitleState('');
        setTitlePath(filePath);
        resetCells([createEmptyCell()]);
        setDirty(false);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filePath, resetCells, initialFilePath, initialFile]);

  // Auto-save: debounce 500ms, only when dirty
  useEffect(() => {
    if (readOnly || !dirty || !filePath) return;
    const timer = setTimeout(() => {
      saveFile(filePath, {
        title: title || undefined,
        cells: cells.map((c) => ({ id: c.id, type: c.type, content: c.content })),
      }).then(() => setDirty(false));
    }, 500);
    return () => clearTimeout(timer);
  }, [readOnly, dirty, filePath, title, cells]);

  // Dirty-marking wrappers — all stable (deps are stable dispatch fns)
  const setTitle = useCallback((newTitle: string) => {
    if (readOnly) return;
    setTitleState(newTitle);
    setDirty(true);
  }, [readOnly]);

  const setCellContent = useCallback(
    (id: string, content: string) => {
      if (readOnly) return;
      rawSetCellContent(id, content);
      setDirty(true);
    },
    [readOnly, rawSetCellContent],
  );

  const addCell = useCallback(
    (afterId: string | null, type: CellType) => {
      if (readOnly) return;
      rawAddCell(afterId, type);
      setDirty(true);
    },
    [readOnly, rawAddCell],
  );

  const deleteCell = useCallback(
    (id: string) => {
      if (readOnly) return;
      rawDeleteCell(id);
      setDirty(true);
    },
    [readOnly, rawDeleteCell],
  );

  const setCellType = useCallback(
    (id: string, cellType: CellType) => {
      if (readOnly) return;
      rawSetCellType(id, cellType);
      setDirty(true);
    },
    [readOnly, rawSetCellType],
  );

  const moveCellUp = useCallback(
    (id: string) => {
      if (readOnly) return;
      rawMoveCellUp(id);
      setDirty(true);
    },
    [readOnly, rawMoveCellUp],
  );

  const moveCellDown = useCallback(
    (id: string) => {
      if (readOnly) return;
      rawMoveCellDown(id);
      setDirty(true);
    },
    [readOnly, rawMoveCellDown],
  );

  const renameFileTo = useCallback(
    async (newFilename: string): Promise<string | null> => {
      if (readOnly || !filePath) return null;
      const dir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/') + 1) : '';
      const newPath = dir + (newFilename.endsWith('.tape') ? newFilename : `${newFilename}.tape`);
      if (newPath === filePath) return null;
      try {
        await renameFile(filePath, newPath);
        onPathChanged?.(newPath);
        return newPath;
      } catch {
        return null;
      }
    },
    [readOnly, filePath, onPathChanged],
  );

  return {
    title,
    titlePath,
    cells,
    cellResults,
    globalAnalysis,
    offsetMap,
    focusedCellId,
    loading,
    dirty,
    setTitle,
    renameFileTo,
    addCell,
    deleteCell,
    setCellContent,
    setCellType,
    moveCellUp,
    moveCellDown,
    setFocusedCellId,
    runAnalysisNow,
  };
}
