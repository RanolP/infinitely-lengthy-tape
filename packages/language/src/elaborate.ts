import type { SAnn, SExpr, SParam } from '@edhit/core';
import { CoreExpr, type CoreBranchF, type CoreExprF } from './core.js';
import { reportError, type Context } from './context.js';

interface ElabScope {
  locals: Map<string, number>;
  depth: number;
}

function emptyScope(ctx: Context): ElabScope {
  return {
    locals: new Map(ctx.names),
    depth: ctx.lvl,
  };
}

function scopeBind(scope: ElabScope, name: string): ElabScope {
  const newLocals = new Map(scope.locals);
  newLocals.set(name, scope.depth);
  return { locals: newLocals, depth: scope.depth + 1 };
}

export function elaborateExpr(ctx: Context, expr: SExpr): CoreExprF<SAnn> {
  const scope = emptyScope(ctx);
  return elabExpr(ctx, scope, expr);
}

function elabExpr(ctx: Context, scope: ElabScope, expr: SExpr): CoreExprF<SAnn> {
  return expr.match({
    Var: (name, ann) => {
      const localLevel = scope.locals.get(name);
      if (localLevel !== undefined) {
        const index = scope.depth - 1 - localLevel;
        return CoreExpr.Var(index, ann);
      }
      if (ctx.globals.has(name)) {
        return CoreExpr.Global(name, ann);
      }
      if (ctx.dataTypes.has(name)) {
        return CoreExpr.Global(name, ann);
      }
      reportError(ctx, ann.span, `unresolved name: ${name}`);
      return CoreExpr.Error(ann);
    },

    App: (func, arg, ann) => {
      const cFunc = elabExpr(ctx, scope, func);
      const cArg = elabExpr(ctx, scope, arg);
      return CoreExpr.App(cFunc, cArg, ann);
    },

    Lam: (param, body, ann) => {
      const innerScope = scopeBind(scope, param);
      const cBody = elabExpr(ctx, innerScope, body);
      return CoreExpr.Lam(param, cBody, ann);
    },

    Pi: (param, body, ann) => elabPi(ctx, scope, param, body, ann),

    Arrow: (domain, codomain, ann) => {
      const cDomain = elabExpr(ctx, scope, domain);
      const innerScope = scopeBind(scope, '_');
      const cCodomain = elabExpr(ctx, innerScope, codomain);
      return CoreExpr.Pi('_', cDomain, cCodomain, ann);
    },

    Type: (ann) => CoreExpr.Type(ann),

    Match: (scrutinee, branches, ann) => {
      const cScrutinee = elabExpr(ctx, scope, scrutinee);
      const cBranches: CoreBranchF<SAnn>[] = branches.map((b) =>
        b.pattern.match({
          Ctor: (ctorName, args, _patAnn) => {
            let branchScope = scope;
            for (const arg of args) {
              branchScope = scopeBind(branchScope, arg);
            }
            return {
              ctorName,
              bindings: args,
              body: elabExpr(ctx, branchScope, b.body),
            };
          },
        }),
      );
      return CoreExpr.Match(cScrutinee, cBranches, ann);
    },

    Hole: (ann) => {
      reportError(ctx, ann.span, 'holes are not yet supported');
      return CoreExpr.Error(ann);
    },

    Data: (_constructors, ann) => {
      reportError(ctx, ann.span, 'data expression cannot be used here');
      return CoreExpr.Error(ann);
    },

    Proj: (innerExpr, name, ann) => {
      const cExpr = elabExpr(ctx, scope, innerExpr);
      return CoreExpr.Proj(cExpr, name.value, ann);
    },
  });
}

function elabPi(
  ctx: Context,
  scope: ElabScope,
  param: SParam,
  body: SExpr,
  ann: SAnn,
): CoreExprF<SAnn> {
  const cTy = elabExpr(ctx, scope, param.ty);
  const name = param.name.value;
  const innerScope = scopeBind(scope, name);
  const cBody = elabExpr(ctx, innerScope, body);
  return CoreExpr.Pi(name, cTy, cBody, ann);
}
