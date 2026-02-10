import type { Pos } from '@edhit/core';

export interface ParseDiagnostic {
  pos: Pos;
  message: string;
}

export class LexError extends Error {
  constructor(
    public pos: Pos,
    message: string,
  ) {
    super(`Lex error at ${pos.line}:${pos.col}: ${message}`);
    this.name = 'LexError';
  }
}

export class ParseError extends Error {
  constructor(
    public pos: Pos,
    message: string,
  ) {
    super(`Parse error at ${pos.line}:${pos.col}: ${message}`);
    this.name = 'ParseError';
  }
}
