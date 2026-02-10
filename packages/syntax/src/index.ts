import type { SProgram } from '@edhit/core';
import type { ParseDiagnostic } from './error.js';
import { Parser } from './parser.js';

export { Lexer } from './lexer.js';
export { Parser } from './parser.js';
export { LexError, ParseError, type ParseDiagnostic } from './error.js';
export { Token, type LocatedToken } from './token.js';

export interface ParseResult {
  program: SProgram;
  errors: ParseDiagnostic[];
}

export function parse(source: string): ParseResult {
  const parser = new Parser(source);
  const program = parser.parseProgram();
  return { program, errors: parser.errors };
}
