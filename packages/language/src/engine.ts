import type { SAnn, SDecl, SExpr, SProgram, Span } from '@edhit/core';
import { parse } from '@edhit/syntax';
import { CoreExpr, type CoreExprF } from './core.js';
import {
  type Context,
  type DataInfo,
  type CtorInfo,
  emptyContext,
} from './context.js';
import { check, infer } from './check.js';
import { elaborateExpr } from './elaborate.js';
import { evaluate, quote } from './eval.js';
import type { TypeError } from './error.js';
import { Neutral, Value } from './value.js';
import { prettyCore } from './pretty.js';

export interface DefInfo {
  name: string;
  span: Span;
  type: string;
  value: string | null;
  constructors: { name: string; type: string }[];
}

export interface CheckResult {
  errors: TypeError[];
  defs: DefInfo[];
}

export function checkSource(source: string): CheckResult {
  const { program } = parse(source);
  return checkProgram(program);
}

export function checkProgram(program: SProgram): CheckResult {
  let ctx = emptyContext();
  const defs: DefInfo[] = [];

  for (const item of program.items) {
    if (item.kind === 'decl') {
      const prevCtx = ctx;
      ctx = checkDecl(ctx, item.value);
      collectDefInfo(item.value, prevCtx, ctx, defs);
    }
  }

  return { errors: ctx.errors, defs };
}

function collectDefInfo(
  decl: SDecl,
  _prevCtx: Context,
  ctx: Context,
  defs: DefInfo[],
): void {
  decl.match({
    Def: (name, _params, _returnTy, body, ann) => {
      const globalInfo = ctx.globals.get(name.value);
      if (!globalInfo) return;

      if (isDataExpr(body)) {
        const tyStr = prettyCore(quote(0, globalInfo.ty));
        const ctors: { name: string; type: string }[] = [];
        const dataInfo = ctx.dataTypes.get(name.value);
        if (dataInfo) {
          for (const [ctorName, ctorInfo] of dataInfo.constructors) {
            ctors.push({
              name: ctorName,
              type: prettyCore(quote(0, ctorInfo.ty)),
            });
          }
        }
        defs.push({
          name: name.value,
          span: ann.span,
          type: tyStr,
          value: null,
          constructors: ctors,
        });
      } else {
        const tyStr = prettyCore(quote(0, globalInfo.ty));
        const valStr = prettyCore(quote(0, globalInfo.val));
        defs.push({
          name: name.value,
          span: ann.span,
          type: tyStr,
          value: valStr,
          constructors: [],
        });
      }
    },
  });
}

function checkDecl(ctx: Context, decl: SDecl): Context {
  return decl.match({
    Def: (name, params, returnTy, body, ann) => {
      if (isDataExpr(body)) {
        return checkDataDef(ctx, name.value, params, returnTy, body, ann);
      }
      return checkDefDecl(ctx, name.value, params, returnTy, body, ann);
    },
  });
}

function isDataExpr(expr: SExpr): boolean {
  return expr.match({
    Data: () => true,
    Var: () => false,
    App: () => false,
    Lam: () => false,
    Pi: () => false,
    Arrow: () => false,
    Type: () => false,
    Match: () => false,
    Hole: () => false,
    Proj: () => false,
  });
}

function checkDataDef(
  ctx: Context,
  name: string,
  params: import('@edhit/core').ParamF<SAnn>[],
  returnTy: SExpr | null,
  body: SExpr,
  _ann: SAnn,
): Context {
  // Extract constructors from the Data expression
  const constructors = body.match({
    Data: (ctors, _ann) => ctors,
    Var: () => [],
    App: () => [],
    Lam: () => [],
    Pi: () => [],
    Arrow: () => [],
    Type: () => [],
    Match: () => [],
    Hole: () => [],
    Proj: () => [],
  });

  let innerCtx = ctx;
  const paramInfos: { name: string; cTy: CoreExprF<unknown> }[] = [];

  // Elaborate and check params, collecting core type expressions
  for (const param of params) {
    const cParamTy = elaborateExpr(innerCtx, param.ty);
    check(innerCtx, cParamTy, Value.VType());
    const paramTyVal = evaluate(innerCtx.env, cParamTy as CoreExprF<unknown>);

    paramInfos.push({ name: param.name.value, cTy: cParamTy as CoreExprF<unknown> });
    const freshVar = Value.VNeutral(paramTyVal, Neutral.NVar(innerCtx.lvl));
    innerCtx = {
      ...innerCtx,
      lvl: innerCtx.lvl + 1,
      bindings: [...innerCtx.bindings, { name: param.name.value, ty: paramTyVal }],
      env: [freshVar, ...innerCtx.env],
      names: new Map(innerCtx.names).set(param.name.value, innerCtx.lvl),
    };
  }

  // Check return type if provided (should be Type), otherwise default to Type
  if (returnTy !== null) {
    const cReturnTy = elaborateExpr(innerCtx, returnTy);
    check(innerCtx, cReturnTy, Value.VType());
  }

  // Build full kind: (p1 : T1) -> ... -> Type
  let kindExpr: CoreExprF<unknown> = CoreExpr.Type(null);
  for (let i = paramInfos.length - 1; i >= 0; i--) {
    const p = paramInfos[i]!;
    kindExpr = CoreExpr.Pi(p.name, p.cTy, kindExpr, null);
  }
  const dataTy = evaluate(ctx.env, kindExpr);

  // Register the data type
  const ctorMap = new Map<string, CtorInfo>();

  // First register data type name so constructors can reference it
  const dataInfo: DataInfo = {
    paramCount: countParams(params),
    ty: dataTy,
    constructors: ctorMap,
  };
  let resultCtx: Context = {
    ...ctx,
    dataTypes: new Map(ctx.dataTypes).set(name, dataInfo),
    errors: innerCtx.errors,
  };

  // Check each constructor
  for (const ctor of constructors) {
    // Re-bind outer params in the result context for elaborating ctor param types
    let ctorInnerCtx: Context = resultCtx;
    for (const param of params) {
      const cParamTy = elaborateExpr(ctorInnerCtx, param.ty);
      const paramTyVal = evaluate(ctorInnerCtx.env, cParamTy as CoreExprF<unknown>);
      const freshVar = Value.VNeutral(paramTyVal, Neutral.NVar(ctorInnerCtx.lvl));
      ctorInnerCtx = {
        ...ctorInnerCtx,
        lvl: ctorInnerCtx.lvl + 1,
        bindings: [...ctorInnerCtx.bindings, { name: param.name.value, ty: paramTyVal }],
        env: [freshVar, ...ctorInnerCtx.env],
        names: new Map(ctorInnerCtx.names).set(param.name.value, ctorInnerCtx.lvl),
      };
    }

    // Elaborate and check each ctor param type
    const ctorParamInfos: { name: string; cTy: CoreExprF<unknown> }[] = [];
    let ctorParamCtx = ctorInnerCtx;
    for (const ctorParam of ctor.params) {
      const cCtorParamTy = elaborateExpr(ctorParamCtx, ctorParam.ty);
      check(ctorParamCtx, cCtorParamTy, Value.VType());
      const ctorParamTyVal = evaluate(ctorParamCtx.env, cCtorParamTy as CoreExprF<unknown>);

      ctorParamInfos.push({ name: ctorParam.name.value, cTy: cCtorParamTy as CoreExprF<unknown> });
      const freshVar = Value.VNeutral(ctorParamTyVal, Neutral.NVar(ctorParamCtx.lvl));
      ctorParamCtx = {
        ...ctorParamCtx,
        lvl: ctorParamCtx.lvl + 1,
        bindings: [...ctorParamCtx.bindings, { name: ctorParam.name.value, ty: ctorParamTyVal }],
        env: [freshVar, ...ctorParamCtx.env],
        names: new Map(ctorParamCtx.names).set(ctorParam.name.value, ctorParamCtx.lvl),
      };
    }

    // Build return type: DataName applied to outer param vars
    let ctorReturnExpr: CoreExprF<unknown> = CoreExpr.Global(name, null);
    const totalCtorParams = ctorParamInfos.length;
    const totalOuterParams = paramInfos.length;
    for (let i = 0; i < totalOuterParams; i++) {
      const index = totalCtorParams + totalOuterParams - 1 - i;
      ctorReturnExpr = CoreExpr.App(ctorReturnExpr, CoreExpr.Var(index, null), null);
    }

    // Build full ctor type: (outer_params) -> (ctor_params) -> DataName(outer_param_vars)
    let ctorTypeExpr: CoreExprF<unknown> = ctorReturnExpr;
    for (let i = ctorParamInfos.length - 1; i >= 0; i--) {
      const p = ctorParamInfos[i]!;
      ctorTypeExpr = CoreExpr.Pi(p.name, p.cTy, ctorTypeExpr, null);
    }
    for (let i = paramInfos.length - 1; i >= 0; i--) {
      const p = paramInfos[i]!;
      ctorTypeExpr = CoreExpr.Pi(p.name, p.cTy, ctorTypeExpr, null);
    }

    const ctorTyVal = evaluate(ctx.env, ctorTypeExpr);

    ctorMap.set(ctor.name.value, {
      dataName: name,
      ty: ctorTyVal,
    });

    // Update errors from inner contexts
    resultCtx = {
      ...resultCtx,
      errors: ctorParamCtx.errors,
    };
  }

  return {
    ...resultCtx,
    globals: new Map(resultCtx.globals).set(name, { ty: dataTy, val: Value.VType() }),
  };
}

function checkDefDecl(
  ctx: Context,
  name: string,
  params: import('@edhit/core').ParamF<SAnn>[],
  returnTy: SExpr | null,
  body: import('@edhit/core').ExprF<SAnn>,
  _ann: SAnn,
): Context {
  let innerCtx = ctx;

  // Elaborate and check params
  for (const param of params) {
    const cParamTy = elaborateExpr(innerCtx, param.ty);
    check(innerCtx, cParamTy, Value.VType());
    const paramTyVal = evaluate(innerCtx.env, cParamTy as CoreExprF<unknown>);

    const freshVar = Value.VNeutral(paramTyVal, Neutral.NVar(innerCtx.lvl));
    innerCtx = {
      ...innerCtx,
      lvl: innerCtx.lvl + 1,
      bindings: [...innerCtx.bindings, { name: param.name.value, ty: paramTyVal }],
      env: [freshVar, ...innerCtx.env],
      names: new Map(innerCtx.names).set(param.name.value, innerCtx.lvl),
    };
  }

  if (returnTy !== null) {
    // Elaborate and check return type
    const cReturnTy = elaborateExpr(innerCtx, returnTy);
    check(innerCtx, cReturnTy, Value.VType());
    const returnTyVal = evaluate(innerCtx.env, cReturnTy as CoreExprF<unknown>);

    // Elaborate and check body against return type
    const cBody = elaborateExpr(innerCtx, body);
    check(innerCtx, cBody, returnTyVal);
    const bodyVal = evaluate(innerCtx.env, cBody as CoreExprF<unknown>);

    return {
      ...ctx,
      globals: new Map(ctx.globals).set(name, { ty: returnTyVal, val: bodyVal }),
      errors: innerCtx.errors,
    };
  } else {
    // No return type — infer from body
    const cBody = elaborateExpr(innerCtx, body);
    const result = infer(innerCtx, cBody);
    const bodyVal = evaluate(innerCtx.env, result.expr as CoreExprF<unknown>);

    return {
      ...ctx,
      globals: new Map(ctx.globals).set(name, { ty: result.ty, val: bodyVal }),
      errors: innerCtx.errors,
    };
  }
}

function countParams(params: import('@edhit/core').ParamF<SAnn>[]): number {
  return params.length;
}
