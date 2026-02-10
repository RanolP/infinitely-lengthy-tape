import type { Annotated } from './annotated.js';
import type { ParamF } from './param.js';

export interface DataCtorF<Ann> {
  name: Annotated<string, Ann>;
  params: ParamF<Ann>[];
  ann: Ann;
}
