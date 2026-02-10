import type { Span } from '@edhit/core';
import type { Env } from './env.js';
import type { TypeError } from './error.js';
import type { Value } from './value.js';

export interface CtorInfo {
  dataName: string;
  ty: Value;
}

export interface DataInfo {
  paramCount: number;
  ty: Value;
  constructors: Map<string, CtorInfo>;
}

export interface Binding {
  name: string;
  ty: Value;
}

export interface Context {
  lvl: number;
  bindings: Binding[];
  env: Env;
  names: Map<string, number>;
  dataTypes: Map<string, DataInfo>;
  globals: Map<string, { ty: Value; val: Value }>;
  errors: TypeError[];
}

export function emptyContext(): Context {
  return {
    lvl: 0,
    bindings: [],
    env: [],
    names: new Map(),
    dataTypes: new Map(),
    globals: new Map(),
    errors: [],
  };
}

export function bind(ctx: Context, name: string, ty: Value, val: Value): Context {
  const newNames = new Map(ctx.names);
  newNames.set(name, ctx.lvl);
  return {
    ...ctx,
    lvl: ctx.lvl + 1,
    bindings: [...ctx.bindings, { name, ty }],
    env: [val, ...ctx.env],
    names: newNames,
  };
}

export function define(ctx: Context, name: string, ty: Value, val: Value): Context {
  return {
    ...ctx,
    globals: new Map(ctx.globals).set(name, { ty, val }),
  };
}

export function reportError(ctx: Context, span: Span, message: string): void {
  ctx.errors.push({ span, message });
}
