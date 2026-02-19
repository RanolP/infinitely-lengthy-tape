import type { SemanticToken, ParseErrorInfo, DefInfo, HoverEntry } from '@edhit/editor-core';
import type { TypeError } from '@edhit/language';

export type CellType = 'code' | 'prose';
export type CellStatus = 'stale' | 'ok' | 'error';

export interface Cell {
  id: string;
  type: CellType;
  content: string;
}

export interface CellAnalysisSlice {
  cellId: string;
  globalOffset: number;
  length: number;
  semanticTokens: SemanticToken[];
  parseErrors: ParseErrorInfo[];
  typeErrors: TypeError[];
  defs: DefInfo[];
  hoverEntries: HoverEntry[];
  status: CellStatus;
}

export interface OffsetMapEntry {
  cellId: string;
  globalStart: number;
  length: number;
}
