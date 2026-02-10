import { handsum, type Handsum } from 'handsum';
import type { Annotated } from './annotated.js';
import type { ExprF } from './expr.js';
import type { ParamF } from './param.js';

interface TDeclF<Ann> {
  Def(
    name: Annotated<string, Ann>,
    params: ParamF<Ann>[],
    returnTy: ExprF<Ann> | null,
    body: ExprF<Ann>,
    ann: Ann,
  ): DeclF<Ann>;
}

interface IDeclF<_Ann> {}

export type DeclF<Ann> = Handsum<TDeclF<Ann>, IDeclF<Ann>>;

const DeclCtor = <Ann>() => handsum<TDeclF<Ann>, IDeclF<Ann>>({});

export const Decl = {
  Def: <A>(
    name: Annotated<string, A>,
    params: ParamF<A>[],
    returnTy: ExprF<A> | null,
    body: ExprF<A>,
    ann: A,
  ): DeclF<A> => DeclCtor<A>().Def(name, params, returnTy, body, ann),
};
