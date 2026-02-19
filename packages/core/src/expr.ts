import { handsum, type Handsum } from 'handsum';
import type { Annotated } from './annotated.js';
import type { DataCtorF } from './data-ctor.js';
import type { ParamF } from './param.js';
import type { PatternF } from './pattern.js';

export interface MatchBranchF<Ann> {
  pattern: PatternF<Ann>;
  body: ExprF<Ann>;
}

interface TExprF<Ann> {
  Var(name: string, ann: Ann): ExprF<Ann>;
  App(func: ExprF<Ann>, arg: ExprF<Ann>, ann: Ann): ExprF<Ann>;
  Lam(param: string, body: ExprF<Ann>, ann: Ann): ExprF<Ann>;
  Pi(param: ParamF<Ann>, body: ExprF<Ann>, ann: Ann): ExprF<Ann>;
  Arrow(domain: ExprF<Ann>, codomain: ExprF<Ann>, ann: Ann): ExprF<Ann>;
  Type(ann: Ann): ExprF<Ann>;
  Match(scrutinee: ExprF<Ann>, branches: MatchBranchF<Ann>[], ann: Ann): ExprF<Ann>;
  Hole(ann: Ann): ExprF<Ann>;
  Data(constructors: DataCtorF<Ann>[], ann: Ann): ExprF<Ann>;
  Proj(expr: ExprF<Ann>, name: Annotated<string, Ann>, ann: Ann): ExprF<Ann>;
  Variant(expr: ExprF<Ann>, ann: Ann): ExprF<Ann>;
}

interface IExprF<_Ann> {}

export type ExprF<Ann> = Handsum<TExprF<Ann>, IExprF<Ann>>;

const ExprCtor = <Ann>() => handsum<TExprF<Ann>, IExprF<Ann>>({});

export const Expr = {
  Var: <A>(name: string, ann: A): ExprF<A> => ExprCtor<A>().Var(name, ann),
  App: <A>(func: ExprF<A>, arg: ExprF<A>, ann: A): ExprF<A> =>
    ExprCtor<A>().App(func, arg, ann),
  Lam: <A>(param: string, body: ExprF<A>, ann: A): ExprF<A> =>
    ExprCtor<A>().Lam(param, body, ann),
  Pi: <A>(param: ParamF<A>, body: ExprF<A>, ann: A): ExprF<A> =>
    ExprCtor<A>().Pi(param, body, ann),
  Arrow: <A>(domain: ExprF<A>, codomain: ExprF<A>, ann: A): ExprF<A> =>
    ExprCtor<A>().Arrow(domain, codomain, ann),
  Type: <A>(ann: A): ExprF<A> => ExprCtor<A>().Type(ann),
  Match: <A>(scrutinee: ExprF<A>, branches: MatchBranchF<A>[], ann: A): ExprF<A> =>
    ExprCtor<A>().Match(scrutinee, branches, ann),
  Hole: <A>(ann: A): ExprF<A> => ExprCtor<A>().Hole(ann),
  Data: <A>(constructors: DataCtorF<A>[], ann: A): ExprF<A> =>
    ExprCtor<A>().Data(constructors, ann),
  Proj: <A>(expr: ExprF<A>, name: Annotated<string, A>, ann: A): ExprF<A> =>
    ExprCtor<A>().Proj(expr, name, ann),
  Variant: <A>(expr: ExprF<A>, ann: A): ExprF<A> =>
    ExprCtor<A>().Variant(expr, ann),
};
