import type { AnalysisResult } from '@edhit/editor-core';
import type { Cell, CellAnalysisSlice, OffsetMapEntry } from '../model/types.js';

export function concatenateCodeCells(cells: Cell[]): { source: string; map: OffsetMapEntry[] } {
  const map: OffsetMapEntry[] = [];
  const parts: string[] = [];
  let globalStart = 0;

  for (const cell of cells) {
    if (cell.type !== 'code') continue;
    const length = cell.content.length;
    map.push({ cellId: cell.id, globalStart, length });
    parts.push(cell.content);
    globalStart += length + 1;
  }

  return { source: parts.join('\n'), map };
}

export function localToGlobal(map: OffsetMapEntry[], cellId: string, localOffset: number): number {
  const entry = map.find((e) => e.cellId === cellId);
  if (!entry) return localOffset;
  return entry.globalStart + localOffset;
}

function findCellForOffset(map: OffsetMapEntry[], globalOffset: number): OffsetMapEntry | null {
  for (let i = map.length - 1; i >= 0; i--) {
    const entry = map[i]!;
    if (globalOffset >= entry.globalStart) return entry;
  }
  return null;
}

function adjustOffset(globalOffset: number, cellEntry: OffsetMapEntry): number {
  return globalOffset - cellEntry.globalStart;
}

function recomputePos(source: string, localOffset: number): { line: number; col: number } {
  let line = 1;
  let col = 0;
  for (let i = 0; i < localOffset && i < source.length; i++) {
    if (source[i] === '\n') {
      line++;
      col = 0;
    } else {
      col++;
    }
  }
  return { line, col };
}

export function partitionAnalysisResult(
  result: AnalysisResult,
  map: OffsetMapEntry[],
  cells: Cell[],
): Map<string, CellAnalysisSlice> {
  const slices = new Map<string, CellAnalysisSlice>();

  for (const entry of map) {
    slices.set(entry.cellId, {
      cellId: entry.cellId,
      globalOffset: entry.globalStart,
      length: entry.length,
      semanticTokens: [],
      parseErrors: [],
      typeErrors: [],
      defs: [],
      hoverEntries: [],
      status: 'ok',
    });
  }

  for (const token of result.semanticTokens) {
    const cellEntry = findCellForOffset(map, token.offset);
    if (!cellEntry) continue;
    const slice = slices.get(cellEntry.cellId);
    if (!slice) continue;
    const localOffset = adjustOffset(token.offset, cellEntry);
    if (localOffset >= 0 && localOffset + token.length <= cellEntry.length) {
      slice.semanticTokens.push({ offset: localOffset, length: token.length, kind: token.kind });
    }
  }

  for (const err of result.parseErrors) {
    const cellEntry = findCellForOffset(map, err.pos.offset);
    if (!cellEntry) continue;
    const slice = slices.get(cellEntry.cellId);
    if (!slice) continue;
    const localOffset = adjustOffset(err.pos.offset, cellEntry);
    const cell = cells.find((c) => c.id === cellEntry.cellId);
    const localPos = cell ? recomputePos(cell.content, localOffset) : { line: err.pos.line, col: err.pos.col };
    slice.parseErrors.push({
      pos: { offset: localOffset, line: localPos.line, col: localPos.col },
      message: err.message,
    });
    slice.status = 'error';
  }

  for (const err of result.typeErrors) {
    const cellEntry = findCellForOffset(map, err.span.start.offset);
    if (!cellEntry) continue;
    const slice = slices.get(cellEntry.cellId);
    if (!slice) continue;
    const startLocal = adjustOffset(err.span.start.offset, cellEntry);
    const endLocal = adjustOffset(err.span.end.offset, cellEntry);
    const cell = cells.find((c) => c.id === cellEntry.cellId);
    const startPos = cell
      ? recomputePos(cell.content, startLocal)
      : { line: err.span.start.line, col: err.span.start.col };
    const endPos = cell
      ? recomputePos(cell.content, endLocal)
      : { line: err.span.end.line, col: err.span.end.col };
    slice.typeErrors.push({
      span: {
        start: { offset: startLocal, line: startPos.line, col: startPos.col },
        end: { offset: endLocal, line: endPos.line, col: endPos.col },
      },
      message: err.message,
    });
    slice.status = 'error';
  }

  for (const def of result.defs) {
    const cellEntry = findCellForOffset(map, def.span.start.offset);
    if (!cellEntry) continue;
    const slice = slices.get(cellEntry.cellId);
    if (!slice) continue;
    const startLocal = adjustOffset(def.span.start.offset, cellEntry);
    const endLocal = adjustOffset(def.span.end.offset, cellEntry);
    const cell = cells.find((c) => c.id === cellEntry.cellId);
    const startPos = cell
      ? recomputePos(cell.content, startLocal)
      : { line: def.span.start.line, col: def.span.start.col };
    const endPos = cell
      ? recomputePos(cell.content, endLocal)
      : { line: def.span.end.line, col: def.span.end.col };
    slice.defs.push({
      ...def,
      span: {
        start: { offset: startLocal, line: startPos.line, col: startPos.col },
        end: { offset: endLocal, line: endPos.line, col: endPos.col },
      },
    });
  }

  for (const entry of result.hoverEntries) {
    const cellEntry = findCellForOffset(map, entry.span.start.offset);
    if (!cellEntry) continue;
    const slice = slices.get(cellEntry.cellId);
    if (!slice) continue;
    const startLocal = adjustOffset(entry.span.start.offset, cellEntry);
    const endLocal = adjustOffset(entry.span.end.offset, cellEntry);
    const cell = cells.find((c) => c.id === cellEntry.cellId);
    const startPos = cell
      ? recomputePos(cell.content, startLocal)
      : { line: entry.span.start.line, col: entry.span.start.col };
    const endPos = cell
      ? recomputePos(cell.content, endLocal)
      : { line: entry.span.end.line, col: entry.span.end.col };
    slice.hoverEntries.push({
      span: {
        start: { offset: startLocal, line: startPos.line, col: startPos.col },
        end: { offset: endLocal, line: endPos.line, col: endPos.col },
      },
      type: entry.type,
    });
  }

  return slices;
}
