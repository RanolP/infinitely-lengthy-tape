import type { Span } from '@edhit/core';

export type Token = {
  data?: [];
  def?: [];
  matchKw?: [];
  Type?: [];
  colon?: [];
  colonEq?: [];
  arrow?: [];
  fatArrow?: [];
  backslash?: [];
  dot?: [];
  lparen?: [];
  rparen?: [];
  lbrace?: [];
  rbrace?: [];
  comma?: [];
  underscore?: [];
  slashdash?: [];
  ident?: [name: string];
  eof?: [];
};

function tok(key: string, ...args: unknown[]): Token {
  return { [key]: args } as Token;
}

export const Token = {
  data: (): Token => tok('data'),
  def: (): Token => tok('def'),
  matchKw: (): Token => tok('matchKw'),
  Type: (): Token => tok('Type'),
  colon: (): Token => tok('colon'),
  colonEq: (): Token => tok('colonEq'),
  arrow: (): Token => tok('arrow'),
  fatArrow: (): Token => tok('fatArrow'),
  backslash: (): Token => tok('backslash'),
  dot: (): Token => tok('dot'),
  lparen: (): Token => tok('lparen'),
  rparen: (): Token => tok('rparen'),
  lbrace: (): Token => tok('lbrace'),
  rbrace: (): Token => tok('rbrace'),
  comma: (): Token => tok('comma'),
  underscore: (): Token => tok('underscore'),
  slashdash: (): Token => tok('slashdash'),
  ident: (name: string): Token => tok('ident', name),
  eof: (): Token => tok('eof'),
} as const;

export interface LocatedToken {
  span: Span;
  token: Token;
}
