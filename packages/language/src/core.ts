export interface CoreBranchF<Ann> {
  ctorName: string;
  bindings: string[];
  body: CoreExprF<Ann>;
}

export type CoreExprF<Ann> =
  | { tag: 'Var'; index: number; ann: Ann }
  | { tag: 'Global'; name: string; ann: Ann }
  | { tag: 'app'; func: CoreExprF<Ann>; arg: CoreExprF<Ann>; ann: Ann }
  | { tag: 'Lam'; name: string; body: CoreExprF<Ann>; ann: Ann }
  | {
      tag: 'Pi';
      name: string;
      domain: CoreExprF<Ann>;
      codomain: CoreExprF<Ann>;
      ann: Ann;
    }
  | { tag: 'Type'; ann: Ann }
  | {
      tag: 'Match';
      scrutinee: CoreExprF<Ann>;
      branches: CoreBranchF<Ann>[];
      ann: Ann;
    }
  | { tag: 'Ctor'; dataName: string; ctorName: string; ann: Ann }
  | { tag: 'Proj'; expr: CoreExprF<Ann>; name: string; ann: Ann }
  | { tag: 'UnresolvedCtor'; name: string; ann: Ann }
  | { tag: 'Error'; ann: Ann };

export const CoreExpr = {
  Var: <A>(index: number, ann: A): CoreExprF<A> => ({ tag: 'Var', index, ann }),
  Global: <A>(name: string, ann: A): CoreExprF<A> => ({ tag: 'Global', name, ann }),
  App: <A>(func: CoreExprF<A>, arg: CoreExprF<A>, ann: A): CoreExprF<A> => ({
    tag: 'app',
    func,
    arg,
    ann,
  }),
  Lam: <A>(name: string, body: CoreExprF<A>, ann: A): CoreExprF<A> => ({
    tag: 'Lam',
    name,
    body,
    ann,
  }),
  Pi: <A>(
    name: string,
    domain: CoreExprF<A>,
    codomain: CoreExprF<A>,
    ann: A,
  ): CoreExprF<A> => ({ tag: 'Pi', name, domain, codomain, ann }),
  Type: <A>(ann: A): CoreExprF<A> => ({ tag: 'Type', ann }),
  Match: <A>(
    scrutinee: CoreExprF<A>,
    branches: CoreBranchF<A>[],
    ann: A,
  ): CoreExprF<A> => ({ tag: 'Match', scrutinee, branches, ann }),
  Ctor: <A>(dataName: string, ctorName: string, ann: A): CoreExprF<A> => ({
    tag: 'Ctor',
    dataName,
    ctorName,
    ann,
  }),
  Proj: <A>(expr: CoreExprF<A>, name: string, ann: A): CoreExprF<A> => ({
    tag: 'Proj',
    expr,
    name,
    ann,
  }),
  UnresolvedCtor: <A>(name: string, ann: A): CoreExprF<A> => ({
    tag: 'UnresolvedCtor',
    name,
    ann,
  }),
  Error: <A>(ann: A): CoreExprF<A> => ({ tag: 'Error', ann }),
};
