import type { CoreBranchF, CoreExprF } from './core.js';

export function prettyCore(
  expr: CoreExprF<unknown>,
  names: string[] = [],
): string {
  switch (expr.tag) {
    case 'Var': {
      const name = names[names.length - 1 - expr.index];
      return name ?? `@${expr.index}`;
    }
    case 'Global':
      return expr.name;
    case 'App':
      return `${prettyCore(expr.func, names)} ${wrapArg(expr.arg, names)}`;
    case 'Lam': {
      const inner = names.concat(expr.name);
      return `\\${expr.name}. ${prettyCore(expr.body, inner)}`;
    }
    case 'Pi': {
      if (expr.name === '_') {
        const inner = names.concat('_');
        return `${wrapArrow(expr.domain, names)} -> ${prettyCore(expr.codomain, inner)}`;
      }
      const inner = names.concat(expr.name);
      return `(${expr.name} : ${prettyCore(expr.domain, names)}) -> ${prettyCore(expr.codomain, inner)}`;
    }
    case 'Type':
      return 'Type';
    case 'Match':
      return prettyMatch(expr.scrutinee, expr.branches, names);
    case 'Ctor':
      return `${expr.dataName}.${expr.ctorName}`;
    case 'Proj':
      return `${wrapArg(expr.expr, names)}.${expr.name}`;
    case 'Error':
      return '<error>';
  }
}

function isAtom(expr: CoreExprF<unknown>): boolean {
  switch (expr.tag) {
    case 'Var':
    case 'Global':
    case 'Type':
    case 'Ctor':
    case 'Error':
      return true;
    default:
      return false;
  }
}

function wrapArg(expr: CoreExprF<unknown>, names: string[]): string {
  if (isAtom(expr)) return prettyCore(expr, names);
  return `(${prettyCore(expr, names)})`;
}

function wrapArrow(expr: CoreExprF<unknown>, names: string[]): string {
  if (expr.tag === 'Pi' || expr.tag === 'Lam') {
    return `(${prettyCore(expr, names)})`;
  }
  return prettyCore(expr, names);
}

function prettyMatch(
  scrutinee: CoreExprF<unknown>,
  branches: CoreBranchF<unknown>[],
  names: string[],
): string {
  if (branches.length === 0) {
    return `match ${prettyCore(scrutinee, names)} { }`;
  }
  const branchStrs = branches.map((b) => {
    const inner = names.concat(b.bindings);
    const bindings = b.bindings.length > 0 ? ' ' + b.bindings.join(' ') : '';
    return `.${b.ctorName}${bindings} => ${prettyCore(b.body, inner)}`;
  });
  return `match ${prettyCore(scrutinee, names)} { ${branchStrs.join(', ')} }`;
}
