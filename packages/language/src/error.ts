import type { Span } from '@edhit/core';

export interface TypeError {
  span: Span;
  message: string;
}
