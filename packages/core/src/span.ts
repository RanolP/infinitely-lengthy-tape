export interface Pos {
  offset: number;
  line: number;
  col: number;
}

export interface Span {
  start: Pos;
  end: Pos;
}

export type Spanned<T> = import('./annotated.js').Annotated<T, { span: Span }>;
