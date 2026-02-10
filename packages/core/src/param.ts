import type { Annotated } from './annotated.js';
import type { ExprF } from './expr.js';

export interface ParamF<Ann> {
  ann: Ann;
  name: Annotated<string, Ann>;
  ty: ExprF<Ann>;
}
