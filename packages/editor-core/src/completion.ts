import type { ScopeEntry } from './scope.js';
import { symbols } from './symbols.js';

export interface CompletionItem {
  label: string;
  detail?: string;
  insertText: string;
  kind: 'symbol' | 'scope' | 'snippet';
}

const snippetCompletions: CompletionItem[] = [
  {
    kind: 'snippet',
    label: 'def',
    detail: 'Definition',
    insertText: 'def _ := _',
  },
  {
    kind: 'snippet',
    label: 'match',
    detail: 'Pattern match',
    insertText: 'match _ { ._ => _ }',
  },
  {
    kind: 'snippet',
    label: 'data',
    detail: 'Data type',
    insertText: 'data { ._ , ._ }',
  },
  {
    kind: 'snippet',
    label: 'lam',
    detail: 'Lambda abstraction',
    insertText: '\\x => ',
  },
];

export function fuzzyMatch(input: string, label: string): boolean {
  if (input === '') return true;
  const lower = label.toLowerCase();
  const inputLower = input.toLowerCase();
  let j = 0;
  for (let i = 0; i < lower.length && j < inputLower.length; i++) {
    if (lower[i] === inputLower[j]) j++;
  }
  return j === inputLower.length;
}

export function levenshtein(a: string, b: string): number {
  const la = a.length;
  const lb = b.length;
  const dp: number[] = Array.from({ length: lb + 1 }, (_, i) => i);
  for (let i = 1; i <= la; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= lb; j++) {
      const tmp = dp[j]!;
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j]!, dp[j - 1]!);
      prev = tmp;
    }
  }
  return dp[lb]!;
}

export function collectCompletions(
  prefix: string,
  scope: ScopeEntry[] = [],
): CompletionItem[] {
  const items: CompletionItem[] = [];

  // Snippet completions
  for (const item of snippetCompletions) {
    if (fuzzyMatch(prefix, item.label)) {
      items.push(item);
    }
  }

  // Scope entries (variables, globals, constructors)
  for (const entry of scope) {
    if (fuzzyMatch(prefix, entry.name)) {
      items.push({
        kind: 'scope',
        label: entry.name,
        detail: entry.kind,
        insertText: entry.name,
      });
    }
  }

  // Symbol completions (unicode symbols)
  if (prefix.length >= 2) {
    for (const sym of symbols) {
      if (fuzzyMatch(prefix, sym.name)) {
        items.push({
          kind: 'symbol',
          label: sym.name,
          detail: sym.char,
          insertText: sym.char,
        });
      }
    }
  }

  // Bold/italic styled variants via suffix
  const lastDot = prefix.lastIndexOf('.');
  if (lastDot >= 1) {
    const basePart = prefix.slice(0, lastDot);
    const suffixPart = prefix.slice(lastDot + 1);

    const styles: { names: string[]; tag: string }[] = [
      { names: ['bold', 'b'], tag: 'b' },
      { names: ['italic', 'i'], tag: 'i' },
    ];

    for (const sym of symbols) {
      if (!fuzzyMatch(basePart, sym.name)) continue;

      for (const { names, tag } of styles) {
        for (const name of names) {
          if (!fuzzyMatch(suffixPart, name)) continue;
          const styledText = `<${tag}>${sym.char}</${tag}>`;
          items.push({
            kind: 'symbol',
            label: `${sym.name}.${name}`,
            detail: sym.char,
            insertText: styledText,
          });
        }
      }
    }
  }

  if (prefix.length >= 1) {
    const lower = prefix.toLowerCase();
    items.sort(
      (a, b) => levenshtein(lower, a.label.toLowerCase()) - levenshtein(lower, b.label.toLowerCase()),
    );
  }

  return items;
}

export function activeSegment(text: string): { prefix: string; segment: string } {
  const lastMarker = Math.max(text.lastIndexOf('^'), text.lastIndexOf('_'));
  if (lastMarker === -1) return { prefix: '', segment: text };
  return { prefix: text.slice(0, lastMarker + 1), segment: text.slice(lastMarker + 1) };
}

export function convertSubSup(text: string): string {
  const result: string[] = [];
  let mode: null | 'sup' | 'sub' = null;
  let current = '';

  for (const ch of text) {
    if (ch === '^' || ch === '_') {
      if (current) {
        if (mode === 'sup') result.push(`<sup>${current}</sup>`);
        else if (mode === 'sub') result.push(`<sub>${current}</sub>`);
        else result.push(current);
      }
      current = '';
      mode = ch === '^' ? 'sup' : 'sub';
    } else {
      current += ch;
    }
  }

  if (current) {
    if (mode === 'sup') result.push(`<sup>${current}</sup>`);
    else if (mode === 'sub') result.push(`<sub>${current}</sub>`);
    else result.push(current);
  }

  return result.join('');
}
