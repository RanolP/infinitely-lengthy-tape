import type { SAnn, Span } from '@edhit/core';
import { CoreExpr, type CoreBranchF, type CoreExprF } from './core.js';
import { bind, reportError, type Context } from './context.js';
import { closureApply } from './env.js';
import { conv, evaluate, quote } from './eval.js';
import { Neutral, Value } from './value.js';

export interface TAnn {
  span: Span;
  ty: Value;
}

export function infer(ctx: Context, expr: CoreExprF<SAnn>): { expr: CoreExprF<TAnn>; ty: Value } {
  switch (expr.tag) {
    case 'Var': {
      const binding = ctx.bindings[ctx.lvl - 1 - expr.index];
      if (!binding) {
        reportError(ctx, expr.ann.span, `invalid de Bruijn index: ${expr.index}`);
        return { expr: CoreExpr.Error(tann(expr.ann, Value.VError())), ty: Value.VError() };
      }
      return {
        expr: CoreExpr.Var(expr.index, tann(expr.ann, binding.ty)),
        ty: binding.ty,
      };
    }

    case 'Global': {
      const info = ctx.globals.get(expr.name);
      if (!info) {
        // Could be a data type
        const dataInfo = ctx.dataTypes.get(expr.name);
        if (dataInfo) {
          return {
            expr: CoreExpr.Global(expr.name, tann(expr.ann, dataInfo.ty)),
            ty: dataInfo.ty,
          };
        }
        reportError(ctx, expr.ann.span, `unresolved global: ${expr.name}`);
        return { expr: CoreExpr.Error(tann(expr.ann, Value.VError())), ty: Value.VError() };
      }
      return {
        expr: CoreExpr.Global(expr.name, tann(expr.ann, info.ty)),
        ty: info.ty,
      };
    }

    case 'App': {
      const funcResult = infer(ctx, expr.func);
      const funcTy = funcResult.ty;

      return funcTy.match({
        VPi: (name, domain, codomain) => {
          const argResult = check(ctx, expr.arg, domain);
          const argVal = evaluate(ctx.env, argResult as CoreExprF<unknown>);
          const resTy = closureApply(codomain, argVal, evaluate);
          return {
            expr: CoreExpr.App(funcResult.expr, argResult, tann(expr.ann, resTy)),
            ty: resTy,
          };
        },
        VError: () => {
          const argResult = infer(ctx, expr.arg);
          return {
            expr: CoreExpr.App(funcResult.expr, argResult.expr, tann(expr.ann, Value.VError())),
            ty: Value.VError(),
          };
        },
        VType: () => appNotFunction(ctx, expr, funcResult),
        VLam: () => appNotFunction(ctx, expr, funcResult),
        VNeutral: () => appNotFunction(ctx, expr, funcResult),
        VCtor: () => appNotFunction(ctx, expr, funcResult),
        VGlobal: () => appNotFunction(ctx, expr, funcResult),
      });
    }

    case 'Pi': {
      const domainResult = check(ctx, expr.domain, Value.VType());
      const domainVal = evaluate(ctx.env, domainResult as CoreExprF<unknown>);
      const freshVar = Value.VNeutral(domainVal, Neutral.NVar(ctx.lvl));
      const innerCtx = bind(ctx, expr.name, domainVal, freshVar);
      const codomainResult = check(innerCtx, expr.codomain, Value.VType());
      return {
        expr: CoreExpr.Pi(
          expr.name,
          domainResult,
          codomainResult,
          tann(expr.ann, Value.VType()),
        ),
        ty: Value.VType(),
      };
    }

    case 'Type':
      return {
        expr: CoreExpr.Type(tann(expr.ann, Value.VType())),
        ty: Value.VType(),
      };

    case 'Ctor': {
      const dataInfo = ctx.dataTypes.get(expr.dataName);
      if (!dataInfo) {
        reportError(ctx, expr.ann.span, `unknown data type: ${expr.dataName}`);
        return { expr: CoreExpr.Error(tann(expr.ann, Value.VError())), ty: Value.VError() };
      }
      const ctorInfo = dataInfo.constructors.get(expr.ctorName);
      if (!ctorInfo) {
        reportError(ctx, expr.ann.span, `unknown constructor: ${expr.ctorName}`);
        return { expr: CoreExpr.Error(tann(expr.ann, Value.VError())), ty: Value.VError() };
      }
      return {
        expr: CoreExpr.Ctor(expr.dataName, expr.ctorName, tann(expr.ann, ctorInfo.ty)),
        ty: ctorInfo.ty,
      };
    }

    case 'Proj': {
      const innerResult = infer(ctx, expr.expr);
      const innerVal = evaluate(ctx.env, innerResult.expr as CoreExprF<unknown>);

      // Resolve data type from the value
      const dataName = resolveDataType(ctx, innerVal);
      if (!dataName) {
        reportError(ctx, expr.ann.span, 'dot projection requires a data type');
        return { expr: CoreExpr.Error(tann(expr.ann, Value.VError())), ty: Value.VError() };
      }
      const dataInfo = ctx.dataTypes.get(dataName)!;
      const ctorInfo = dataInfo.constructors.get(expr.name);
      if (!ctorInfo) {
        reportError(ctx, expr.ann.span, `unknown constructor .${expr.name}`);
        return { expr: CoreExpr.Error(tann(expr.ann, Value.VError())), ty: Value.VError() };
      }

      // Apply data type arguments to constructor type
      const dataArgs = extractDataArgs(innerVal);
      let ctorTy = ctorInfo.ty;
      for (const arg of dataArgs) {
        ctorTy = ctorTy.match({
          VPi: (_name, _domain, codomain) => closureApply(codomain, arg, evaluate),
          VError: () => Value.VError(),
          VType: () => Value.VError(),
          VLam: () => Value.VError(),
          VNeutral: () => Value.VError(),
          VCtor: () => Value.VError(),
          VGlobal: () => Value.VError(),
        });
      }

      return {
        expr: CoreExpr.Ctor(dataName, expr.name, tann(expr.ann, ctorTy)),
        ty: ctorTy,
      };
    }

    case 'Match': {
      const scrutineeResult = infer(ctx, expr.scrutinee);
      if (expr.branches.length === 0) {
        reportError(ctx, expr.ann.span, 'match expression with no branches');
        return {
          expr: CoreExpr.Match(
            scrutineeResult.expr,
            [],
            tann(expr.ann, Value.VError()),
          ),
          ty: Value.VError(),
        };
      }

      const branchResults: CoreBranchF<TAnn>[] = [];
      let resultTy: Value | null = null;

      for (const branch of expr.branches) {
        const branchResult = inferBranch(ctx, branch, scrutineeResult.ty);
        branchResults.push(branchResult.branch);
        if (resultTy === null) {
          resultTy = branchResult.ty;
        } else if (!conv(ctx.lvl, resultTy, branchResult.ty)) {
          reportError(
            ctx,
            branch.body.ann.span,
            'branch type mismatch',
          );
        }
      }

      const ty = resultTy ?? Value.VError();
      return {
        expr: CoreExpr.Match(scrutineeResult.expr, branchResults, tann(expr.ann, ty)),
        ty,
      };
    }

    case 'Lam':
      reportError(ctx, expr.ann.span, 'cannot infer type of lambda; add a type annotation');
      return { expr: CoreExpr.Error(tann(expr.ann, Value.VError())), ty: Value.VError() };

    case 'Error':
      return { expr: CoreExpr.Error(tann(expr.ann, Value.VError())), ty: Value.VError() };
  }
}

function appNotFunction(
  ctx: Context,
  expr: CoreExprF<SAnn> & { tag: 'App' },
  funcResult: { expr: CoreExprF<TAnn>; ty: Value },
): { expr: CoreExprF<TAnn>; ty: Value } {
  reportError(ctx, expr.ann.span, 'expected a function type');
  const argResult = infer(ctx, expr.arg);
  return {
    expr: CoreExpr.App(funcResult.expr, argResult.expr, tann(expr.ann, Value.VError())),
    ty: Value.VError(),
  };
}

export function check(ctx: Context, expr: CoreExprF<SAnn>, expected: Value): CoreExprF<TAnn> {
  if (expr.tag === 'Lam') {
    return expected.match({
      VPi: (piName, domain, codomain) => {
        const freshVar = Value.VNeutral(domain, Neutral.NVar(ctx.lvl));
        const innerCtx = bind(ctx, expr.name, domain, freshVar);
        const codomainVal = closureApply(codomain, freshVar, evaluate);
        const bodyResult = check(innerCtx, expr.body, codomainVal);
        return CoreExpr.Lam(expr.name, bodyResult, tann(expr.ann, expected));
      },
      VError: () => CoreExpr.Error(tann(expr.ann, Value.VError())),
      VType: () => lamExpectedPi(ctx, expr, expected),
      VLam: () => lamExpectedPi(ctx, expr, expected),
      VNeutral: () => lamExpectedPi(ctx, expr, expected),
      VCtor: () => lamExpectedPi(ctx, expr, expected),
      VGlobal: () => lamExpectedPi(ctx, expr, expected),
    });
  }

  // Fall through to infer + conversion check
  const result = infer(ctx, expr);
  if (!conv(ctx.lvl, result.ty, expected)) {
    const expectedQuoted = quote(ctx.lvl, expected);
    const gotQuoted = quote(ctx.lvl, result.ty);
    reportError(
      ctx,
      expr.ann.span,
      `type mismatch: expected ${prettyCore(expectedQuoted)}, got ${prettyCore(gotQuoted)}`,
    );
  }
  return result.expr;
}

function lamExpectedPi(
  ctx: Context,
  expr: CoreExprF<SAnn> & { tag: 'Lam' },
  _expected: Value,
): CoreExprF<TAnn> {
  reportError(ctx, expr.ann.span, 'lambda requires a function type');
  return CoreExpr.Error(tann(expr.ann, Value.VError()));
}

function resolveDataType(ctx: Context, val: Value): string | null {
  return val.match({
    VGlobal: (name, _args, _value) => (ctx.dataTypes.has(name) ? name : null),
    VType: () => null,
    VPi: () => null,
    VLam: () => null,
    VNeutral: () => null,
    VCtor: () => null,
    VError: () => null,
  });
}

function extractDataArgs(val: Value): Value[] {
  return val.match({
    VGlobal: (_name, args, _value) => args,
    VType: () => [],
    VPi: () => [],
    VLam: () => [],
    VNeutral: () => [],
    VCtor: () => [],
    VError: () => [],
  });
}

function inferBranch(
  ctx: Context,
  branch: CoreBranchF<SAnn>,
  scrutineeTy: Value,
): { branch: CoreBranchF<TAnn>; ty: Value } {
  // Try to resolve data type from scrutinee type to get proper binding types
  const dataName = resolveDataType(ctx, scrutineeTy);
  let innerCtx = ctx;

  if (dataName) {
    const dataInfo = ctx.dataTypes.get(dataName)!;
    const dataArgs = extractDataArgs(scrutineeTy);
    const ctorInfo = dataInfo.constructors.get(branch.ctorName);

    if (ctorInfo) {
      // Apply data type arguments to the constructor type
      let ctorTy = ctorInfo.ty;
      for (const arg of dataArgs) {
        ctorTy = ctorTy.match({
          VPi: (_name, _domain, codomain) => closureApply(codomain, arg, evaluate),
          VError: () => Value.VError(),
          VType: () => Value.VError(),
          VLam: () => Value.VError(),
          VNeutral: () => Value.VError(),
          VCtor: () => Value.VError(),
          VGlobal: () => Value.VError(),
        });
      }

      // Extract binding types from the constructor type (Pi domains)
      for (const binding of branch.bindings) {
        const bindingTy = ctorTy.match({
          VPi: (_name, domain, codomain) => {
            const freshVar = Value.VNeutral(domain, Neutral.NVar(innerCtx.lvl));
            ctorTy = closureApply(codomain, freshVar, evaluate);
            return domain;
          },
          VError: () => Value.VError(),
          VType: () => Value.VError(),
          VLam: () => Value.VError(),
          VNeutral: () => Value.VError(),
          VCtor: () => Value.VError(),
          VGlobal: () => Value.VError(),
        });
        const freshVar = Value.VNeutral(bindingTy, Neutral.NVar(innerCtx.lvl));
        innerCtx = bind(innerCtx, binding, bindingTy, freshVar);
      }
    } else {
      // Unknown constructor — bind with VError
      for (const binding of branch.bindings) {
        const freshVar = Value.VNeutral(Value.VError(), Neutral.NVar(innerCtx.lvl));
        innerCtx = bind(innerCtx, binding, Value.VError(), freshVar);
      }
    }
  } else {
    // Cannot resolve data type — bind with VError
    for (const binding of branch.bindings) {
      const freshVar = Value.VNeutral(Value.VError(), Neutral.NVar(innerCtx.lvl));
      innerCtx = bind(innerCtx, binding, Value.VError(), freshVar);
    }
  }

  const bodyResult = infer(innerCtx, branch.body);
  return {
    branch: {
      ctorName: branch.ctorName,
      bindings: branch.bindings,
      body: bodyResult.expr,
    },
    ty: bodyResult.ty,
  };
}

function tann(sann: SAnn, ty: Value): TAnn {
  return { span: sann.span, ty };
}

function prettyCore(expr: CoreExprF<unknown>): string {
  switch (expr.tag) {
    case 'Var':
      return `@${expr.index}`;
    case 'Global':
      return expr.name;
    case 'App':
      return `(${prettyCore(expr.func)} ${prettyCore(expr.arg)})`;
    case 'Lam':
      return `(\\${expr.name}. ${prettyCore(expr.body)})`;
    case 'Pi':
      if (expr.name === '_') {
        return `(${prettyCore(expr.domain)} -> ${prettyCore(expr.codomain)})`;
      }
      return `((${expr.name} : ${prettyCore(expr.domain)}) -> ${prettyCore(expr.codomain)})`;
    case 'Type':
      return 'Type';
    case 'Match':
      return `(match ...)`;
    case 'Ctor':
      return `${expr.dataName}.${expr.ctorName}`;
    case 'Proj':
      return `(${prettyCore(expr.expr)}).${expr.name}`;
    case 'Error':
      return '<error>';
  }
}
