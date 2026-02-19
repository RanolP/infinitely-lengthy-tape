import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { analyze, type AnalysisResult } from '@edhit/editor-core';
import { concatenateCodeCells, partitionAnalysisResult } from '../utils/offset-map.js';
import type { Cell, CellAnalysisSlice, OffsetMapEntry } from '../model/types.js';

export interface NotebookAnalysisState {
  cellResults: Map<string, CellAnalysisSlice>;
  globalAnalysis: AnalysisResult | null;
  offsetMap: OffsetMapEntry[];
  runAnalysisNow: () => void;
}

function runAnalysis(cells: Cell[]) {
  const { source, map } = concatenateCodeCells(cells);
  const result = analyze(source);
  const slices = partitionAnalysisResult(result, map, cells);
  return { result, map, slices };
}

/** Fingerprint that only changes when code cells change (id, order, or content). */
function codeCellsKey(cells: Cell[]): string {
  let key = '';
  for (const c of cells) {
    if (c.type === 'code') {
      key += c.id + ':' + c.content.length + ':' + c.content + '\0';
    }
  }
  return key;
}

export function useNotebookAnalysis(cells: Cell[]): NotebookAnalysisState {
  const [cellResults, setCellResults] = useState<Map<string, CellAnalysisSlice>>(new Map());
  const [globalAnalysis, setGlobalAnalysis] = useState<AnalysisResult | null>(null);
  const [offsetMap, setOffsetMap] = useState<OffsetMapEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cellsRef = useRef(cells);
  cellsRef.current = cells;

  // Only re-run analysis when code cells actually change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const codeKey = useMemo(() => codeCellsKey(cells), [cells]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const { result, map, slices } = runAnalysis(cellsRef.current);
      setGlobalAnalysis(result);
      setOffsetMap(map);
      setCellResults(slices);
    }, 150);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [codeKey]);

  const runAnalysisNow = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const { result, map, slices } = runAnalysis(cellsRef.current);
    setGlobalAnalysis(result);
    setOffsetMap(map);
    setCellResults(slices);
  }, []);

  return { cellResults, globalAnalysis, offsetMap, runAnalysisNow };
}
