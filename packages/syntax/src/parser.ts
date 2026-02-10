import {
  type Annotated,
  type DataCtorF,
  Decl,
  Expr,
  Pattern,
  type SAnn,
  type SDataCtor,
  type SDecl,
  type SExpr,
  type SMatchBranch,
  type SParam,
  type SPattern,
  type SProgramItem,
  type SProgram,
  type Span,
} from '@edhit/core';
import { ParseError, type ParseDiagnostic } from './error.js';
import { Lexer } from './lexer.js';
import type { LocatedToken } from './token.js';

function exprAnn(expr: SExpr): SAnn {
  return expr.match({
    Var: (_name, ann) => ann,
    App: (_func, _arg, ann) => ann,
    Lam: (_param, _body, ann) => ann,
    Pi: (_param, _body, ann) => ann,
    Arrow: (_domain, _codomain, ann) => ann,
    Type: (ann) => ann,
    Match: (_scrutinee, _branches, ann) => ann,
    Hole: (ann) => ann,
    Data: (_constructors, ann) => ann,
    Proj: (_expr, _name, ann) => ann,
  });
}

interface SavePoint {
  pos: number;
  errorCount: number;
}

export class Parser {
  private tokens: LocatedToken[];
  private pos = 0;
  readonly errors: ParseDiagnostic[];

  constructor(source: string) {
    const lexer = new Lexer(source);
    this.tokens = lexer.tokenize();
    this.errors = [...lexer.errors];
  }

  private current(): LocatedToken {
    return this.tokens[this.pos]!;
  }

  private advance(): LocatedToken {
    const tok = this.tokens[this.pos]!;
    if (!tok.token.eof) {
      this.pos++;
    }
    return tok;
  }

  private expect(check: (tok: LocatedToken) => boolean, expected: string): LocatedToken {
    const tok = this.current();
    if (!check(tok)) {
      throw new ParseError(tok.span.start, `expected ${expected}, got ${tokenDescription(tok)}`);
    }
    return this.advance();
  }

  /** Non-throwing expect: returns the token if found, otherwise records error and returns a synthetic token. */
  private expectOrInsert(check: (tok: LocatedToken) => boolean, expected: string): LocatedToken {
    const tok = this.current();
    if (!check(tok)) {
      this.errors.push({ pos: tok.span.start, message: `expected ${expected}, got ${tokenDescription(tok)}` });
      // Return a synthetic token at current position without advancing
      return { span: { start: tok.span.start, end: tok.span.start }, token: tok.token };
    }
    return this.advance();
  }

  private expectIdent(): Annotated<string, SAnn> {
    const tok = this.current();
    if (tok.token.ident) {
      this.advance();
      return { value: tok.token.ident[0], ann: { span: tok.span } };
    }
    throw new ParseError(tok.span.start, `expected identifier, got ${tokenDescription(tok)}`);
  }

  private isAtEnd(): boolean {
    return !!this.current().token.eof;
  }

  private save(): SavePoint {
    return { pos: this.pos, errorCount: this.errors.length };
  }

  private restore(saved: SavePoint): void {
    this.pos = saved.pos;
    this.errors.length = saved.errorCount;
  }

  private span(start: Span, end: Span): Span {
    return { start: start.start, end: end.end };
  }

  /** Skip tokens until `check` returns true or eof. */
  private skipUntil(check: (tok: LocatedToken) => boolean): void {
    while (!this.isAtEnd() && !check(this.current())) {
      this.advance();
    }
  }

  /** Is the current token a synchronization point for list items? */
  private isSyncToken(): boolean {
    const t = this.current().token;
    return !!(t.comma || t.rbrace || t.eof);
  }

  // ── Slashdash helper ───────────────────────────────────────────

  private trySlashdash(): boolean {
    if (this.current().token.slashdash) {
      this.advance();
      return true;
    }
    return false;
  }

  // ── Program ────────────────────────────────────────────────────

  parseProgram(): SProgram {
    const startSpan = this.current().span;
    const items: SProgramItem[] = [];

    while (!this.isAtEnd()) {
      // If we see `def` or `/-`, parse normally
      if (this.current().token.def || this.current().token.slashdash) {
        try {
          if (this.trySlashdash()) {
            this.parseDecl(); // parse and discard
            continue;
          }
          const decl = this.parseDecl();
          const ann: SAnn = { span: decl.match({ Def: (_n, _p, _r, _b, a) => a.span }) };
          items.push({ kind: 'decl', value: decl, ann });
        } catch (e) {
          if (e instanceof ParseError) {
            this.errors.push({ pos: e.pos, message: e.message });
            // Skip to next 'def' keyword for recovery
            this.skipUntil((t) => !!t.token.def);
          } else {
            throw e;
          }
        }
      } else {
        // Unexpected top-level token — record error and skip to next 'def'
        const tok = this.current();
        this.errors.push({
          pos: tok.span.start,
          message: `expected declaration ('def'), got ${tokenDescription(tok)}`,
        });
        this.advance(); // skip one token
        this.skipUntil((t) => !!t.token.def);
      }
    }

    const endSpan = this.current().span;
    return { ann: { span: this.span(startSpan, endSpan) }, items };
  }

  // ── Declarations ───────────────────────────────────────────────

  private parseDecl(): SDecl {
    const tok = this.current();
    if (tok.token.def) return this.parseDef();
    throw new ParseError(
      tok.span.start,
      `expected declaration ('def'), got ${tokenDescription(tok)}`,
    );
  }

  private parseDef(): SDecl {
    const start = this.advance(); // consume 'def'
    const name = this.expectIdent();
    const params = this.parseParams();

    let returnTy: SExpr | null = null;

    if (this.current().token.colon) {
      // Has return type: `def name params : Type := body`
      this.advance(); // consume ':'
      returnTy = this.parseExpr();
      this.expect((t) => !!t.token.colonEq, "':='");
    } else {
      // No return type: `def name params := body`
      this.expect((t) => !!t.token.colonEq, "':='");
    }

    const body = this.parseExpr();
    return Decl.Def(name, params, returnTy, body, {
      span: this.span(start.span, exprAnn(body).span),
    });
  }

  // ── Params ─────────────────────────────────────────────────────

  private parseParams(): SParam[] {
    const params: SParam[] = [];
    while (this.current().token.lparen) {
      params.push(this.parseParam());
    }
    return params;
  }

  private parseParam(): SParam {
    const lp = this.advance(); // consume '('
    let name: Annotated<string, SAnn>;
    if (this.current().token.underscore) {
      const tok = this.advance();
      name = { value: '_', ann: { span: tok.span } };
    } else if (this.current().token.ident) {
      name = this.expectIdent();
    } else {
      throw new ParseError(
        this.current().span.start,
        'expected identifier in parameter',
      );
    }
    this.expect((t) => !!t.token.colon, "':'");
    const ty = this.parseExpr();
    const rp = this.expect((t) => !!t.token.rparen, "')'");
    return { ann: { span: this.span(lp.span, rp.span) }, name, ty };
  }

  // ── Expressions ────────────────────────────────────────────────

  parseExpr(): SExpr {
    const tok = this.current();

    // Lambda: \x. body
    if (tok.token.backslash) {
      return this.parseLambda();
    }

    // Match: match e { .p => e, ... }
    if (tok.token.matchKw) {
      return this.parseMatch();
    }

    return this.parsePiOrArrow();
  }

  private parseLambda(): SExpr {
    const start = this.advance(); // consume '\'
    const param = this.expectIdent();
    this.expect((t) => !!t.token.dot, "'.'");
    const body = this.parseExpr();
    return Expr.Lam(param.value, body, {
      span: this.span(start.span, exprAnn(body).span),
    });
  }

  private parseMatch(): SExpr {
    const start = this.advance(); // consume 'match'
    const scrutinee = this.parseExpr();
    this.expect((t) => !!t.token.lbrace, "'{'");

    const branches: SMatchBranch[] = [];

    if (!this.current().token.rbrace && !this.isAtEnd()) {
      // First branch
      this.tryParseBranch(branches);

      // Subsequent branches separated by ','
      while (this.current().token.comma) {
        this.advance(); // consume ','
        if (this.current().token.rbrace || this.isAtEnd()) break; // trailing comma
        this.tryParseBranch(branches);
      }
    }

    const end = this.expectOrInsert((t) => !!t.token.rbrace, "'}'");
    return Expr.Match(scrutinee, branches, {
      span: this.span(start.span, end.span),
    });
  }

  /** Try to parse a match branch with recovery on failure. */
  private tryParseBranch(branches: SMatchBranch[]): void {
    try {
      if (this.current().token.slashdash) {
        this.advance();
        this.parseBranchItem(); // parse and discard
      } else {
        branches.push(this.parseBranchItem());
      }
    } catch (e) {
      if (e instanceof ParseError) {
        this.errors.push({ pos: e.pos, message: e.message });
        // Skip to next comma or closing brace
        this.skipUntil((t) => this.isSyncToken());
      } else {
        throw e;
      }
    }
  }

  private parseBranchItem(): SMatchBranch {
    const pattern = this.parsePattern();
    this.expect((t) => !!t.token.fatArrow, "'=>'");
    const body = this.parseExpr();
    return { pattern, body };
  }

  private parsePattern(): SPattern {
    const dotTok = this.expect((t) => !!t.token.dot, "'.'");
    const name = this.expectIdent();
    const args: string[] = [];
    while (this.current().token.ident || this.current().token.underscore) {
      if (this.current().token.underscore) {
        args.push('_');
        this.advance();
      } else {
        args.push(this.expectIdent().value);
      }
    }
    return Pattern.Ctor(name.value, args, { span: this.span(dotTok.span, name.ann.span) });
  }

  // ── Pi / Arrow ─────────────────────────────────────────────────

  private parsePiOrArrow(): SExpr {
    // Try Pi: (x : A) -> B
    if (this.current().token.lparen) {
      const saved = this.save();
      try {
        return this.parsePi();
      } catch {
        this.restore(saved);
      }
    }

    // Application, possibly followed by ->
    const lhs = this.parseApp();
    if (this.current().token.arrow) {
      this.advance(); // consume '->'
      const rhs = this.parsePiOrArrow();
      return Expr.Arrow(lhs, rhs, {
        span: this.span(exprAnn(lhs).span, exprAnn(rhs).span),
      });
    }
    return lhs;
  }

  private parsePi(): SExpr {
    const lp = this.advance(); // consume '('
    const name = this.expectIdent();
    this.expect((t) => !!t.token.colon, "':'");
    const ty = this.parseExpr();
    this.expect((t) => !!t.token.rparen, "')'");
    this.expect((t) => !!t.token.arrow, "'->'");
    const body = this.parsePiOrArrow();

    const param: SParam = {
      ann: { span: this.span(lp.span, exprAnn(ty).span) },
      name,
      ty,
    };
    return Expr.Pi(param, body, {
      span: this.span(lp.span, exprAnn(body).span),
    });
  }

  // ── Application ────────────────────────────────────────────────

  private parseApp(): SExpr {
    let result = this.parseAtom();

    while (this.isAtomStart()) {
      const arg = this.parseAtom();
      result = Expr.App(result, arg, {
        span: this.span(exprAnn(result).span, exprAnn(arg).span),
      });
    }

    return result;
  }

  private isAtomStart(): boolean {
    const tok = this.current().token;
    return !!(tok.ident || tok.Type || tok.lparen || tok.underscore || tok.data);
  }

  // ── Atoms ──────────────────────────────────────────────────────

  private parseAtom(): SExpr {
    let result = this.parseAtomBase();

    // Postfix dot projection: expr.name
    while (this.current().token.dot && this.isIdentAfterDot()) {
      this.advance(); // consume '.'
      const name = this.expectIdent();
      result = Expr.Proj(result, name, {
        span: this.span(exprAnn(result).span, name.ann.span),
      });
    }

    return result;
  }

  private isIdentAfterDot(): boolean {
    // Check if the next token after '.' is an identifier (not a keyword)
    const nextPos = this.pos + 1;
    if (nextPos >= this.tokens.length) return false;
    return !!this.tokens[nextPos]!.token.ident;
  }

  private parseAtomBase(): SExpr {
    const tok = this.current();

    if (tok.token.ident) {
      this.advance();
      return Expr.Var(tok.token.ident[0], { span: tok.span });
    }

    if (tok.token.Type) {
      this.advance();
      return Expr.Type({ span: tok.span });
    }

    if (tok.token.underscore) {
      this.advance();
      return Expr.Hole({ span: tok.span });
    }

    if (tok.token.lparen) {
      this.advance(); // consume '('
      const inner = this.parseExpr();
      this.expect((t) => !!t.token.rparen, "')'");
      return inner;
    }

    if (tok.token.data) {
      return this.parseDataExpr();
    }

    // Error recovery: return a Hole for unexpected tokens
    this.errors.push({ pos: tok.span.start, message: `expected expression, got ${tokenDescription(tok)}` });
    // Only advance if this isn't a sync token (to avoid eating delimiters)
    if (!this.isSyncToken() && !this.isAtEnd()) {
      this.advance();
    }
    return Expr.Hole({ span: tok.span });
  }

  // ── Data expression ────────────────────────────────────────────

  private parseDataExpr(): SExpr {
    const start = this.advance(); // consume 'data'
    this.expect((t) => !!t.token.lbrace, "'{'");

    const constructors: SDataCtor[] = [];

    // Check for empty data: `data {}`
    if (!this.current().token.rbrace && !this.isAtEnd()) {
      // First constructor
      this.tryParseDataCtor(constructors);

      // Subsequent constructors separated by ','
      while (this.current().token.comma) {
        this.advance(); // consume ','
        if (this.current().token.rbrace || this.isAtEnd()) break; // trailing comma
        this.tryParseDataCtor(constructors);
      }
    }

    const end = this.expectOrInsert((t) => !!t.token.rbrace, "'}'");
    return Expr.Data(constructors, {
      span: this.span(start.span, end.span),
    });
  }

  /** Try to parse a data constructor with recovery on failure. */
  private tryParseDataCtor(constructors: SDataCtor[]): void {
    try {
      if (this.current().token.slashdash) {
        this.advance(); // consume '/-'
        this.parseDataCtorItem(); // parse and discard
      } else {
        constructors.push(this.parseDataCtorItem());
      }
    } catch (e) {
      if (e instanceof ParseError) {
        this.errors.push({ pos: e.pos, message: e.message });
        // Skip to next comma or closing brace
        this.skipUntil((t) => this.isSyncToken());
      } else {
        throw e;
      }
    }
  }

  private parseDataCtorItem(): SDataCtor {
    const dotTok = this.expect((t) => !!t.token.dot, "'.'");
    const name = this.expectIdent();
    const params = this.parseParams();
    const endSpan = params.length > 0 ? params[params.length - 1]!.ann.span : name.ann.span;
    return {
      name,
      params,
      ann: { span: this.span(dotTok.span, endSpan) },
    };
  }
}

function tokenDescription(tok: LocatedToken): string {
  const t = tok.token;
  if (t.data) return "'data'";
  if (t.def) return "'def'";
  if (t.matchKw) return "'match'";
  if (t.Type) return "'Type'";
  if (t.colon) return "':'";
  if (t.colonEq) return "':='";
  if (t.arrow) return "'->'";
  if (t.fatArrow) return "'=>'";
  if (t.backslash) return "'\\'";
  if (t.dot) return "'.'";
  if (t.lparen) return "'('";
  if (t.rparen) return "')'";
  if (t.lbrace) return "'{'";
  if (t.rbrace) return "'}'";
  if (t.comma) return "','";
  if (t.underscore) return "'_'";
  if (t.slashdash) return "'/-'";
  if (t.ident) return `identifier '${t.ident[0]}'`;
  if (t.eof) return 'end of input';
  return 'unknown token';
}
