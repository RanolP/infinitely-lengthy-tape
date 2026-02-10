export {
  type AnalysisResult,
  type ParseErrorInfo,
  type SemanticToken,
  type SemanticKind,
  analyze,
} from './analysis.js';
export type { DefInfo } from '@edhit/language';
export { type ScopeEntry, collectScopeAtOffset } from './scope.js';
export {
  type CompletionItem,
  collectCompletions,
  fuzzyMatch,
  levenshtein,
  activeSegment,
  convertSubSup,
} from './completion.js';
export { symbols } from './symbols.js';
