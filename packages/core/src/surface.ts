import type { Span } from './span.js';
import type { ExprF, MatchBranchF } from './expr.js';
import type { DeclF } from './decl.js';
import type { DataCtorF } from './data-ctor.js';
import type { PatternF } from './pattern.js';
import type { ParamF } from './param.js';
import type { ProgramItemF, ProgramF } from './program.js';

export interface SAnn {
  span: Span;
}

export type SExpr = ExprF<SAnn>;
export type SMatchBranch = MatchBranchF<SAnn>;
export type SDecl = DeclF<SAnn>;
export type SDataCtor = DataCtorF<SAnn>;
export type SPattern = PatternF<SAnn>;
export type SParam = ParamF<SAnn>;
export type SProgramItem = ProgramItemF<SAnn>;
export type SProgram = ProgramF<SAnn>;
