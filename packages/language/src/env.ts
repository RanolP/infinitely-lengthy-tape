import type { CoreExprF } from './core.js';
import type { Value } from './value.js';

export type Env = ReadonlyArray<Value>;

export interface Closure {
  env: Env;
  body: CoreExprF<unknown>;
}

export function closureApply(
  closure: Closure,
  arg: Value,
  evaluate: (env: Env, expr: CoreExprF<unknown>) => Value,
): Value {
  return evaluate([arg, ...closure.env], closure.body);
}
