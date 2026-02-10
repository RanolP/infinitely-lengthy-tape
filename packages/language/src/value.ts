import { handsum, type Handsum } from 'handsum';
import type { Closure } from './env.js';

export interface NeutralBranch {
  ctorName: string;
  bindings: string[];
  body: Closure;
}

interface TValue {
  VType(): Value;
  VPi(name: string, domain: Value, codomain: Closure): Value;
  VLam(name: string, body: Closure): Value;
  VNeutral(ty: Value, neutral: Neutral): Value;
  VCtor(dataName: string, ctorName: string, args: Value[]): Value;
  VGlobal(name: string, args: Value[], value: () => Value): Value;
  VError(): Value;
}

interface IValue {}

export type Value = Handsum<TValue, IValue>;
export const Value = handsum<TValue, IValue>({});

interface TNeutral {
  NVar(level: number): Neutral;
  NApp(head: Neutral, arg: Value): Neutral;
  NMatch(scrutinee: Neutral, branches: NeutralBranch[]): Neutral;
}

interface INeutral {}

export type Neutral = Handsum<TNeutral, INeutral>;
export const Neutral = handsum<TNeutral, INeutral>({});
