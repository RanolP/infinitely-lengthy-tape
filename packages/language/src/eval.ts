import { CoreExpr, type CoreBranchF, type CoreExprF } from './core.js';
import { type Closure, type Env, closureApply } from './env.js';
import { Neutral, Value, type NeutralBranch } from './value.js';

export function evaluate(env: Env, expr: CoreExprF<unknown>): Value {
  switch (expr.tag) {
    case 'Var':
      return env[expr.index]!;

    case 'Global':
      return Value.VGlobal(expr.name, [], () => {
        throw new Error(`unresolved global: ${expr.name}`);
      });

    case 'app': {
      const func = evaluate(env, expr.func);
      const arg = evaluate(env, expr.arg);
      return vApp(func, arg);
    }

    case 'Lam':
      return Value.VLam(expr.name, { env, body: expr.body });

    case 'Pi': {
      const domain = evaluate(env, expr.domain);
      return Value.VPi(expr.name, domain, { env, body: expr.codomain });
    }

    case 'Type':
      return Value.VType();

    case 'Match': {
      const scrutinee = evaluate(env, expr.scrutinee);
      return vMatch(env, scrutinee, expr.branches);
    }

    case 'Ctor':
      return Value.VCtor(expr.dataName, expr.ctorName, []);

    case 'Proj':
      // Type checker rewrites Proj to Ctor, so this shouldn't normally be reached
      return Value.VError();

    case 'UnresolvedCtor':
      // Should be resolved during type checking
      return Value.VError();

    case 'Error':
      return Value.VError();
  }
}

function vApp(func: Value, arg: Value): Value {
  return func.match({
    VLam: (_name, body) => closureApply(body, arg, evaluate),
    VNeutral: (ty, neutral) => {
      const resTy = ty.match({
        VPi: (_name, _domain, codomain) => closureApply(codomain, arg, evaluate),
        VError: () => Value.VError(),
        VType: () => Value.VError(),
        VLam: () => Value.VError(),
        VNeutral: () => Value.VError(),
        VCtor: () => Value.VError(),
        VGlobal: () => Value.VError(),
      });
      return Value.VNeutral(resTy, Neutral.NApp(neutral, arg));
    },
    VCtor: (dataName, ctorName, args) => Value.VCtor(dataName, ctorName, [...args, arg]),
    VGlobal: (name, args, value) => {
      const newArgs = [...args, arg];
      return Value.VGlobal(name, newArgs, () => vApp(value(), arg));
    },
    VError: () => Value.VError(),
    VType: () => Value.VError(),
    VPi: () => Value.VError(),
  });
}

function vMatch(env: Env, scrutinee: Value, branches: CoreBranchF<unknown>[]): Value {
  return scrutinee.match({
    VCtor: (_dataName, ctorName, args) => {
      for (const branch of branches) {
        if (branch.ctorName === ctorName) {
          let branchEnv: Env = env;
          for (const arg of args) {
            branchEnv = [arg, ...branchEnv];
          }
          return evaluate(branchEnv, branch.body);
        }
      }
      return Value.VError();
    },
    VNeutral: (ty, neutral) => {
      const neutralBranches: NeutralBranch[] = branches.map((b) => ({
        ctorName: b.ctorName,
        bindings: b.bindings,
        body: { env, body: b.body },
      }));
      return Value.VNeutral(ty, Neutral.NMatch(neutral, neutralBranches));
    },
    VError: () => Value.VError(),
    VType: () => Value.VError(),
    VPi: () => Value.VError(),
    VLam: () => Value.VError(),
    VGlobal: (_name, _args, value) => vMatch(env, value(), branches),
  });
}

export function quote(lvl: number, value: Value): CoreExprF<null> {
  return value.match({
    VType: () => CoreExpr.Type(null),

    VPi: (name, domain, codomain) => {
      const qDomain = quote(lvl, domain);
      const arg = Value.VNeutral(domain, Neutral.NVar(lvl));
      const qCodomain = quote(lvl + 1, closureApply(codomain, arg, evaluate));
      return CoreExpr.Pi(name, qDomain, qCodomain, null);
    },

    VLam: (name, body) => {
      const arg = Value.VNeutral(Value.VError(), Neutral.NVar(lvl));
      const qBody = quote(lvl + 1, closureApply(body, arg, evaluate));
      return CoreExpr.Lam(name, qBody, null);
    },

    VNeutral: (_ty, neutral) => quoteNeutral(lvl, neutral),

    VCtor: (dataName, ctorName, args) => {
      let result: CoreExprF<null> = CoreExpr.Ctor(dataName, ctorName, null);
      for (const arg of args) {
        result = CoreExpr.App(result, quote(lvl, arg), null);
      }
      return result;
    },

    VGlobal: (name, args, _value) => {
      let result: CoreExprF<null> = CoreExpr.Global(name, null);
      for (const arg of args) {
        result = CoreExpr.App(result, quote(lvl, arg), null);
      }
      return result;
    },

    VError: () => CoreExpr.Error(null),
  });
}

function quoteNeutral(lvl: number, neutral: Neutral): CoreExprF<null> {
  return neutral.match({
    NVar: (level) => CoreExpr.Var(lvl - 1 - level, null),

    NApp: (head, arg) => {
      const qHead = quoteNeutral(lvl, head);
      const qArg = quote(lvl, arg);
      return CoreExpr.App(qHead, qArg, null);
    },

    NMatch: (scrutinee, branches) => {
      const qScrutinee = quoteNeutral(lvl, scrutinee);
      const qBranches: CoreBranchF<null>[] = branches.map((b) => {
        let branchLvl = lvl;
        let env: Env = [];
        for (const _binding of b.bindings) {
          const arg = Value.VNeutral(Value.VError(), Neutral.NVar(branchLvl));
          env = [arg, ...env];
          branchLvl++;
        }
        const fullEnv = [...env, ...b.body.env];
        return {
          ctorName: b.ctorName,
          bindings: b.bindings,
          body: quote(branchLvl, evaluate(fullEnv, b.body.body)),
        };
      });
      return CoreExpr.Match(qScrutinee, qBranches, null);
    },
  });
}

export function conv(lvl: number, v1: Value, v2: Value): boolean {
  return v1.match({
    VError: () => true,
    VType: () =>
      v2.match({
        VType: () => true,
        VError: () => true,
        VPi: () => false,
        VLam: () => false,
        VNeutral: () => false,
        VCtor: () => false,
        VGlobal: () => false,
      }),
    VPi: (name1, domain1, codomain1) =>
      v2.match({
        VPi: (_name2, domain2, codomain2) => {
          if (!conv(lvl, domain1, domain2)) return false;
          const arg = Value.VNeutral(domain1, Neutral.NVar(lvl));
          return conv(
            lvl + 1,
            closureApply(codomain1, arg, evaluate),
            closureApply(codomain2, arg, evaluate),
          );
        },
        VError: () => true,
        VType: () => false,
        VLam: () => false,
        VNeutral: () => false,
        VCtor: () => false,
        VGlobal: () => false,
      }),
    VLam: (name1, body1) =>
      v2.match({
        VLam: (_name2, body2) => {
          const arg = Value.VNeutral(Value.VError(), Neutral.NVar(lvl));
          return conv(
            lvl + 1,
            closureApply(body1, arg, evaluate),
            closureApply(body2, arg, evaluate),
          );
        },
        VNeutral: () => {
          // eta expand: (\x. f x) = g  iff  f[x := fresh] = g fresh
          const arg = Value.VNeutral(Value.VError(), Neutral.NVar(lvl));
          return conv(lvl + 1, closureApply(body1, arg, evaluate), vApp(v2, arg));
        },
        VError: () => true,
        VType: () => false,
        VPi: () => false,
        VCtor: () => false,
        VGlobal: () => false,
      }),
    VNeutral: (_ty1, neutral1) =>
      v2.match({
        VNeutral: (_ty2, neutral2) => convNeutral(lvl, neutral1, neutral2),
        VLam: (_name2, body2) => {
          // eta expand: n = (\x. f x) iff n fresh = f[x := fresh]
          const arg = Value.VNeutral(Value.VError(), Neutral.NVar(lvl));
          return conv(lvl + 1, vApp(v1, arg), closureApply(body2, arg, evaluate));
        },
        VError: () => true,
        VType: () => false,
        VPi: () => false,
        VCtor: () => false,
        VGlobal: () => false,
      }),
    VCtor: (dataName1, ctorName1, args1) =>
      v2.match({
        VCtor: (dataName2, ctorName2, args2) => {
          if (dataName1 !== dataName2 || ctorName1 !== ctorName2) return false;
          if (args1.length !== args2.length) return false;
          return args1.every((a, i) => conv(lvl, a, args2[i]!));
        },
        VError: () => true,
        VType: () => false,
        VPi: () => false,
        VLam: () => false,
        VNeutral: () => false,
        VGlobal: () => false,
      }),
    VGlobal: (name1, args1, _value1) =>
      v2.match({
        VGlobal: (name2, args2, _value2) => {
          if (name1 !== name2) return false;
          if (args1.length !== args2.length) return false;
          return args1.every((a, i) => conv(lvl, a, args2[i]!));
        },
        VError: () => true,
        VType: () => false,
        VPi: () => false,
        VLam: () => false,
        VNeutral: () => false,
        VCtor: () => false,
      }),
  });
}

function convNeutral(lvl: number, n1: Neutral, n2: Neutral): boolean {
  return n1.match({
    NVar: (level1) =>
      n2.match({
        NVar: (level2) => level1 === level2,
        NApp: () => false,
        NMatch: () => false,
      }),
    NApp: (head1, arg1) =>
      n2.match({
        NApp: (head2, arg2) => convNeutral(lvl, head1, head2) && conv(lvl, arg1, arg2),
        NVar: () => false,
        NMatch: () => false,
      }),
    NMatch: (scrutinee1, branches1) =>
      n2.match({
        NMatch: (scrutinee2, branches2) => {
          if (!convNeutral(lvl, scrutinee1, scrutinee2)) return false;
          if (branches1.length !== branches2.length) return false;
          return branches1.every((b1, i) => {
            const b2 = branches2[i]!;
            if (b1.ctorName !== b2.ctorName) return false;
            if (b1.bindings.length !== b2.bindings.length) return false;
            let branchLvl = lvl;
            const args: Value[] = [];
            for (const _binding of b1.bindings) {
              args.push(Value.VNeutral(Value.VError(), Neutral.NVar(branchLvl)));
              branchLvl++;
            }
            const env1 = [...args.reverse(), ...b1.body.env];
            const env2 = [...args, ...b2.body.env];
            return conv(
              branchLvl,
              evaluate(env1, b1.body.body),
              evaluate(env2, b2.body.body),
            );
          });
        },
        NVar: () => false,
        NApp: () => false,
      }),
  });
}
