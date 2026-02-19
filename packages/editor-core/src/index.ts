export {
  type AnalysisResult,
  type ParseErrorInfo,
  type SemanticToken,
  type SemanticKind,
  analyze,
} from './analysis.js';
export type { DefInfo, HoverEntry } from '@edhit/language';
export { type ScopeEntry, type MatchPatternContext, collectScopeAtOffset, findMatchPatternContext } from './scope.js';
export {
  type CompletionContext,
  type CompletionItem,
  collectCompletions,
  fuzzyMatch,
  levenshtein,
  activeSegment,
  convertSubSup,
} from './completion.js';
export { symbols } from './symbols.js';
