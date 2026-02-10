import type { SProgram, SExpr, SDecl, SAnn, Span } from '@edhit/core';

export interface ScopeEntry {
  name: string;
  kind: 'variable' | 'constructor' | 'global';
}

/**
 * Walk the surface AST to find names in scope at a given source offset.
 * Collects globals from preceding declarations, then descends into the
 * declaration/expression containing the offset to collect local bindings.
 */
export function collectScopeAtOffset(program: SProgram, offset: number): ScopeEntry[] {
  const scope: ScopeEntry[] = [];

  let containingDeclIndex = -1;
  for (let i = 0; i < program.items.length; i++) {
    const item = program.items[i]!;
    if (spanContains(item.ann.span, offset)) {
      containingDeclIndex = i;
      break;
    }
  }

  // Collect globals from all preceding declarations
  const limit = containingDeclIndex === -1 ? program.items.length : containingDeclIndex;
  for (let i = 0; i < limit; i++) {
    const item = program.items[i]!;
    if (item.kind === 'decl') {
      collectDeclName(item.value, scope);
    }
  }

  // Descend into the containing declaration
  if (containingDeclIndex !== -1) {
    const item = program.items[containingDeclIndex]!;
    if (item.kind === 'decl') {
      collectDeclScope(item.value, offset, scope);
    } else {
      collectExprScope(item.value, offset, scope);
    }
  }

  return scope;
}

function spanContains(span: Span, offset: number): boolean {
  return offset >= span.start.offset && offset <= span.end.offset;
}

function collectDeclName(decl: SDecl, scope: ScopeEntry[]): void {
  decl.match({
    Def: (name, _params, _returnTy, _body, _ann) => {
      if (name.value) {
        scope.push({ name: name.value, kind: 'global' });
      }
    },
  });
}

function collectDeclScope(decl: SDecl, offset: number, scope: ScopeEntry[]): void {
  decl.match({
    Def: (name, params, returnTy, body, _ann) => {
      // Self-reference for recursion
      if (name.value) {
        scope.push({ name: name.value, kind: 'global' });
      }

      // If offset is in the body or return type, all params are in scope
      const inBody = spanContains(body.match({
        Var: (_n, ann) => ann.span,
        App: (_f, _a, ann) => ann.span,
        Lam: (_p, _b, ann) => ann.span,
        Pi: (_p, _b, ann) => ann.span,
        Arrow: (_d, _c, ann) => ann.span,
        Type: (ann) => ann.span,
        Match: (_s, _b, ann) => ann.span,
        Hole: (ann) => ann.span,
        Data: (_c, ann) => ann.span,
        Proj: (_e, _n, ann) => ann.span,
      }), offset);

      const inReturnTy = returnTy !== null && spanContains(getExprSpan(returnTy), offset);

      if (inBody || inReturnTy) {
        for (const param of params) {
          if (param.name.value) {
            scope.push({ name: param.name.value, kind: 'variable' });
          }
        }
        if (inBody) {
          collectExprScope(body, offset, scope);
        }
        return;
      }

      // If offset is in a param type, earlier params are in scope
      for (let i = 0; i < params.length; i++) {
        const param = params[i]!;
        if (spanContains(param.ann.span, offset)) {
          for (let j = 0; j < i; j++) {
            if (params[j]!.name.value) {
              scope.push({ name: params[j]!.name.value, kind: 'variable' });
            }
          }
          collectExprScope(param.ty, offset, scope);
          return;
        }
      }
    },
  });
}

function collectExprScope(expr: SExpr, offset: number, scope: ScopeEntry[]): void {
  expr.match({
    Lam: (param, body, _ann) => {
      if (spanContains(getExprSpan(body), offset)) {
        if (param) {
          scope.push({ name: param, kind: 'variable' });
        }
        collectExprScope(body, offset, scope);
      }
    },
    Pi: (param, body, _ann) => {
      if (spanContains(getExprSpan(body), offset)) {
        if (param.name.value) {
          scope.push({ name: param.name.value, kind: 'variable' });
        }
        collectExprScope(body, offset, scope);
      } else if (spanContains(param.ann.span, offset)) {
        collectExprScope(param.ty, offset, scope);
      }
    },
    Match: (scrutinee, branches, _ann) => {
      if (spanContains(getExprSpan(scrutinee), offset)) {
        collectExprScope(scrutinee, offset, scope);
        return;
      }
      for (const branch of branches) {
        const bodySpan = getExprSpan(branch.body);
        if (spanContains(bodySpan, offset)) {
          // Collect pattern bindings
          branch.pattern.match({
            Ctor: (_name, args, _pAnn) => {
              for (const arg of args) {
                if (arg && arg !== '_') {
                  scope.push({ name: arg, kind: 'variable' });
                }
              }
            },
          });
          collectExprScope(branch.body, offset, scope);
          return;
        }
      }
    },
    App: (func, arg, _ann) => {
      if (spanContains(getExprSpan(func), offset)) {
        collectExprScope(func, offset, scope);
      } else if (spanContains(getExprSpan(arg), offset)) {
        collectExprScope(arg, offset, scope);
      }
    },
    Arrow: (domain, codomain, _ann) => {
      if (spanContains(getExprSpan(domain), offset)) {
        collectExprScope(domain, offset, scope);
      } else if (spanContains(getExprSpan(codomain), offset)) {
        collectExprScope(codomain, offset, scope);
      }
    },
    Data: (constructors, _ann) => {
      for (const ctor of constructors) {
        if (spanContains(ctor.ann.span, offset)) {
          for (let i = 0; i < ctor.params.length; i++) {
            const param = ctor.params[i]!;
            if (spanContains(param.ann.span, offset)) {
              for (let j = 0; j < i; j++) {
                if (ctor.params[j]!.name.value) {
                  scope.push({ name: ctor.params[j]!.name.value, kind: 'variable' });
                }
              }
              collectExprScope(param.ty, offset, scope);
              return;
            }
          }
          return;
        }
      }
    },
    Proj: (innerExpr, _name, _ann) => {
      if (spanContains(getExprSpan(innerExpr), offset)) {
        collectExprScope(innerExpr, offset, scope);
      }
    },
    Var: () => {},
    Type: () => {},
    Hole: () => {},
  });
}

function getExprSpan(expr: SExpr): Span {
  return expr.match({
    Var: (_n, ann: SAnn) => ann.span,
    App: (_f, _a, ann: SAnn) => ann.span,
    Lam: (_p, _b, ann: SAnn) => ann.span,
    Pi: (_p, _b, ann: SAnn) => ann.span,
    Arrow: (_d, _c, ann: SAnn) => ann.span,
    Type: (ann: SAnn) => ann.span,
    Match: (_s, _b, ann: SAnn) => ann.span,
    Hole: (ann: SAnn) => ann.span,
    Data: (_c, ann: SAnn) => ann.span,
    Proj: (_e, _n, ann: SAnn) => ann.span,
  });
}
