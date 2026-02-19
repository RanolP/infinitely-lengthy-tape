import type {
  Pos,
  Span,
  SProgram,
  SExpr,
  SDecl,
  SDataCtor,
  SParam,
  SMatchBranch,
} from '@edhit/core';
import { parse, Lexer } from '@edhit/syntax';
import { checkProgram, type TypeError, type DefInfo, type HoverEntry } from '@edhit/language';

export interface ParseErrorInfo {
  pos: Pos;
  message: string;
}

export interface SemanticToken {
  offset: number;
  length: number;
  kind: SemanticKind;
}

export type SemanticKind =
  | 'keyword'
  | 'variable'
  | 'global'
  | 'constructor'
  | 'type'
  | 'punctuation'
  | 'hole'
  | 'operator';

export interface AnalysisResult {
  source: string;
  program: SProgram;
  parseErrors: ParseErrorInfo[];
  typeErrors: TypeError[];
  semanticTokens: SemanticToken[];
  defs: DefInfo[];
  hoverEntries: HoverEntry[];
}

export function analyze(source: string): AnalysisResult {
  // Collect semantic tokens from lexer (keywords, punctuation)
  const semanticTokens: SemanticToken[] = [];
  try {
    const lexer = new Lexer(source);
    const tokens = lexer.tokenize();
    for (const tok of tokens) {
      const offset = tok.span.start.offset;
      const length = tok.span.end.offset - tok.span.start.offset;
      if (length === 0) continue;

      if (tok.token.def !== undefined || tok.token.matchKw !== undefined || tok.token.data !== undefined) {
        semanticTokens.push({ offset, length, kind: 'keyword' });
      } else if (tok.token.Type !== undefined) {
        semanticTokens.push({ offset, length, kind: 'type' });
      } else if (tok.token.underscore !== undefined) {
        semanticTokens.push({ offset, length, kind: 'hole' });
      } else if (tok.token.arrow !== undefined || tok.token.fatArrow !== undefined || tok.token.colonEq !== undefined) {
        semanticTokens.push({ offset, length, kind: 'operator' });
      } else if (
        tok.token.comma !== undefined ||
        tok.token.pipe !== undefined ||
        tok.token.colon !== undefined ||
        tok.token.backslash !== undefined ||
        tok.token.dot !== undefined ||
        tok.token.lparen !== undefined ||
        tok.token.rparen !== undefined ||
        tok.token.lbrace !== undefined ||
        tok.token.rbrace !== undefined ||
        tok.token.slashdash !== undefined
      ) {
        semanticTokens.push({ offset, length, kind: 'punctuation' });
      }
      // ident tokens will be classified from the AST walk below
    }
  } catch {
    // If lexing fails partially, we still have the tokens collected so far
  }

  // Parse (recoverable — always returns a program + errors)
  const parseResult = parse(source);
  const program: SProgram = parseResult.program;
  const parseErrors: ParseErrorInfo[] = parseResult.errors.map((e) => ({
    pos: e.pos,
    message: e.message,
  }));

  // Walk AST to classify identifiers
  collectAstTokens(program, semanticTokens);

  // Type check
  let typeErrors: TypeError[] = [];
  let defs: DefInfo[] = [];
  let hoverEntries: HoverEntry[] = [];
  try {
    const result = checkProgram(program);
    typeErrors = result.errors;
    defs = result.defs;
    hoverEntries = result.hoverEntries;
  } catch {
    // Type checking failure is non-fatal
  }

  return { source, program, parseErrors, typeErrors, semanticTokens, defs, hoverEntries };
}

function addToken(tokens: SemanticToken[], span: Span, kind: SemanticKind): void {
  const offset = span.start.offset;
  const length = span.end.offset - span.start.offset;
  if (length > 0) {
    tokens.push({ offset, length, kind });
  }
}

function collectAstTokens(program: SProgram, tokens: SemanticToken[]): void {
  for (const item of program.items) {
    if (item.kind === 'decl') {
      collectDeclTokens(item.value, tokens);
    } else {
      collectExprTokens(item.value, tokens);
    }
  }
}

function collectDeclTokens(decl: SDecl, tokens: SemanticToken[]): void {
  decl.match({
    Def: (name, params, returnTy, body, _ann) => {
      // Def name is a global
      addToken(tokens, name.ann.span, 'global');
      for (const param of params) {
        collectParamTokens(param, tokens);
      }
      if (returnTy !== null) {
        collectExprTokens(returnTy, tokens);
      }
      collectExprTokens(body, tokens);
    },
  });
}

function collectParamTokens(param: SParam, tokens: SemanticToken[]): void {
  addToken(tokens, param.name.ann.span, 'variable');
  collectExprTokens(param.ty, tokens);
}

function collectExprTokens(expr: SExpr, tokens: SemanticToken[]): void {
  expr.match({
    Var: (name, ann) => {
      addToken(tokens, ann.span, 'variable');
    },
    App: (func, arg, _ann) => {
      collectExprTokens(func, tokens);
      collectExprTokens(arg, tokens);
    },
    Lam: (_param, body, _ann) => {
      // param name is part of the span, but we'd need the exact offset
      // The backslash and param name are handled by lexer tokens
      collectExprTokens(body, tokens);
    },
    Pi: (param, body, _ann) => {
      collectParamTokens(param, tokens);
      collectExprTokens(body, tokens);
    },
    Arrow: (domain, codomain, _ann) => {
      collectExprTokens(domain, tokens);
      collectExprTokens(codomain, tokens);
    },
    Type: (_ann) => {
      // Already handled by lexer as 'type'
    },
    Match: (scrutinee, branches, _ann) => {
      collectExprTokens(scrutinee, tokens);
      for (const branch of branches) {
        collectBranchTokens(branch, tokens);
      }
    },
    Hole: (_ann) => {
      // Already handled by lexer as 'hole'
    },
    Data: (constructors, _ann) => {
      for (const ctor of constructors) {
        collectCtorTokens(ctor, tokens);
      }
    },
    Proj: (_expr, name, _ann) => {
      collectExprTokens(_expr, tokens);
      addToken(tokens, name.ann.span, 'constructor');
    },
    Variant: (innerExpr, _ann) => {
      collectExprTokens(innerExpr, tokens);
    },
  });
}

function collectBranchTokens(branch: SMatchBranch, tokens: SemanticToken[]): void {
  branch.pattern.match({
    Ctor: (_name, _args, _ann) => {
      // Pattern constructor name — classified by lexer as ident
      // We could classify it here, but the exact span for the name
      // within the pattern isn't directly available from args
    },
  });
  collectExprTokens(branch.body, tokens);
}

function collectCtorTokens(ctor: SDataCtor, tokens: SemanticToken[]): void {
  addToken(tokens, ctor.name.ann.span, 'constructor');
  for (const param of ctor.params) {
    collectParamTokens(param, tokens);
  }
}
