import type { Pos, Span } from '@edhit/core';
import { LexError, type ParseDiagnostic } from './error.js';
import { Token, type LocatedToken } from './token.js';

const KEYWORDS: Record<string, () => Token> = {
  data: () => Token.data(),
  def: () => Token.def(),
  match: () => Token.matchKw(),
  Type: () => Token.Type(),
};

function isReservedChar(ch: string): boolean {
  switch (ch) {
    case ',':
    case ':':
    case '\\':
    case '.':
    case '(':
    case ')':
    case '{':
    case '}':
    case '=':
    case '-':
    case '_':
      return true;
    default:
      return false;
  }
}

function isIdentChar(ch: string): boolean {
  return !isWhitespace(ch) && !isReservedChar(ch);
}

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r';
}

export class Lexer {
  private offset = 0;
  private line = 1;
  private col = 1;
  readonly errors: ParseDiagnostic[] = [];

  constructor(private source: string) {}

  private pos(): Pos {
    return { offset: this.offset, line: this.line, col: this.col };
  }

  private peek(): string | undefined {
    return this.source[this.offset];
  }

  private peekAt(offset: number): string | undefined {
    return this.source[this.offset + offset];
  }

  private advance(): string {
    const ch = this.source[this.offset]!;
    this.offset++;
    if (ch === '\n') {
      this.line++;
      this.col = 1;
    } else {
      this.col++;
    }
    return ch;
  }

  private skipWhitespace(): void {
    while (this.offset < this.source.length && isWhitespace(this.peek()!)) {
      this.advance();
    }
  }

  private skipLineComment(): void {
    while (this.offset < this.source.length && this.peek() !== '\n') {
      this.advance();
    }
  }

  private skipBlockComment(): void {
    // We already consumed `//[`
    let depth = 1;
    while (this.offset < this.source.length && depth > 0) {
      if (this.peek() === '/' && this.peekAt(1) === '/' && this.peekAt(2) === '[') {
        this.advance();
        this.advance();
        this.advance();
        depth++;
      } else if (this.peek() === '/' && this.peekAt(1) === '/' && this.peekAt(2) === ']') {
        this.advance();
        this.advance();
        this.advance();
        depth--;
      } else {
        this.advance();
      }
    }
  }

  private readIdent(start: Pos): LocatedToken {
    const begin = start.offset;
    while (this.offset < this.source.length && isIdentChar(this.peek()!)) {
      this.advance();
    }
    const name = this.source.slice(begin, this.offset);
    const span: Span = { start, end: this.pos() };
    const keyword = KEYWORDS[name];
    if (keyword) {
      return { span, token: keyword() };
    }
    return { span, token: Token.ident(name) };
  }

  next(): LocatedToken {
    for (;;) {
      this.skipWhitespace();

      if (this.offset >= this.source.length) {
        const p = this.pos();
        return { span: { start: p, end: p }, token: Token.eof() };
      }

      const start = this.pos();
      const ch = this.peek()!;

      // Handle `//` (comments) and `/-` (slashdash); lone `/` is part of ident
      if (ch === '/') {
        if (this.peekAt(1) === '/') {
          if (this.peekAt(2) === '[') {
            this.advance(); // /
            this.advance(); // /
            this.advance(); // [
            this.skipBlockComment();
            continue;
          }
          this.advance(); // /
          this.advance(); // /
          this.skipLineComment();
          continue;
        }
        if (this.peekAt(1) === '-') {
          this.advance(); // /
          this.advance(); // -
          return {
            span: { start, end: this.pos() },
            token: Token.slashdash(),
          };
        }
        // lone `/` — fall through to ident
      }

      // Single-char tokens
      if (ch === ',') {
        this.advance();
        return { span: { start, end: this.pos() }, token: Token.comma() };
      }
      if (ch === ':') {
        this.advance();
        if (this.peek() === '=') {
          this.advance();
          return { span: { start, end: this.pos() }, token: Token.colonEq() };
        }
        return { span: { start, end: this.pos() }, token: Token.colon() };
      }
      if (ch === '\\') {
        this.advance();
        return {
          span: { start, end: this.pos() },
          token: Token.backslash(),
        };
      }
      if (ch === '.') {
        this.advance();
        return { span: { start, end: this.pos() }, token: Token.dot() };
      }
      if (ch === '(') {
        this.advance();
        return { span: { start, end: this.pos() }, token: Token.lparen() };
      }
      if (ch === ')') {
        this.advance();
        return { span: { start, end: this.pos() }, token: Token.rparen() };
      }
      if (ch === '{') {
        this.advance();
        return { span: { start, end: this.pos() }, token: Token.lbrace() };
      }
      if (ch === '}') {
        this.advance();
        return { span: { start, end: this.pos() }, token: Token.rbrace() };
      }

      // `=>` only (no standalone `=`)
      if (ch === '=') {
        if (this.peekAt(1) === '>') {
          this.advance();
          this.advance();
          return {
            span: { start, end: this.pos() },
            token: Token.fatArrow(),
          };
        }
        this.errors.push({ pos: start, message: `unexpected character '='; use ':=' for definitions` });
        this.advance();
        continue;
      }

      // `->`
      if (ch === '-') {
        if (this.peekAt(1) === '>') {
          this.advance();
          this.advance();
          return {
            span: { start, end: this.pos() },
            token: Token.arrow(),
          };
        }
        this.errors.push({ pos: start, message: `unexpected character '-'` });
        this.advance();
        continue;
      }

      // `_` — either underscore token or start of identifier
      if (ch === '_') {
        if (this.offset + 1 < this.source.length && isIdentChar(this.peekAt(1)!)) {
          this.advance();
          return this.readIdent(start);
        }
        this.advance();
        return {
          span: { start, end: this.pos() },
          token: Token.underscore(),
        };
      }

      // Identifiers and keywords (anything not whitespace or reserved)
      this.advance();
      return this.readIdent(start);
    }
  }

  tokenize(): LocatedToken[] {
    const tokens: LocatedToken[] = [];
    for (;;) {
      const tok = this.next();
      tokens.push(tok);
      if (tok.token.eof) break;
    }
    return tokens;
  }
}
