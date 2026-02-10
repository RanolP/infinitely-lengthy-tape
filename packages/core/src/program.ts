import type { DeclF } from './decl.js';
import type { ExprF } from './expr.js';

export type ProgramItemF<Ann> =
  | { readonly kind: 'decl'; readonly value: DeclF<Ann>; readonly ann: Ann }
  | { readonly kind: 'expr'; readonly value: ExprF<Ann>; readonly ann: Ann };

export interface ProgramF<Ann> {
  ann: Ann;
  items: ProgramItemF<Ann>[];
}
