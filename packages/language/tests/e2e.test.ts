import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkSource } from '../src/engine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface TestCase {
  source: string;
  expectedErrors: string[];
  line: number;
}

function parseTestFile(path: string): TestCase[] {
  const content = readFileSync(path, 'utf-8');
  const blocks = content.split(/^======$/m);
  const cases: TestCase[] = [];
  let offset = 0;

  for (const block of blocks) {
    const line = content.slice(0, offset).split('\n').length;
    offset += block.length + 7; // '======\n'.length

    const trimmed = block.trim();
    if (trimmed === '') continue;

    const parts = trimmed.split(/^---$/m);
    const source = parts[0]!.trimEnd();
    const expectedErrors =
      parts.length > 1
        ? parts[1]!
            .trim()
            .split('\n')
            .map((l: string) => l.trim())
            .filter((l: string) => l !== '')
        : [];

    cases.push({ source, expectedErrors, line });
  }

  return cases;
}

function runTestFile(name: string) {
  const cases = parseTestFile(resolve(__dirname, name));

  for (const tc of cases) {
    const firstLine = tc.source.split('\n')[0]!.trim();
    const label =
      tc.expectedErrors.length > 0
        ? `L${tc.line}: ${firstLine} --- ${tc.expectedErrors[0]}`
        : `L${tc.line}: ${firstLine}`;

    it(label, () => {
      const result = checkSource(tc.source);

      if (tc.expectedErrors.length === 0) {
        expect(result.errors, `expected no errors for:\n${tc.source}`).toEqual([]);
      } else {
        const messages = result.errors.map((e) => e.message);
        for (const expected of tc.expectedErrors) {
          const found = messages.some((m) => m.includes(expected));
          expect(
            found,
            `expected error containing "${expected}" in [${messages.join(', ')}]`,
          ).toBe(true);
        }
        expect(result.errors.length).toBe(tc.expectedErrors.length);
      }
    });
  }
}

const testFiles = readdirSync(__dirname)
  .filter((f) => f.endsWith('.test'))
  .sort();

for (const file of testFiles) {
  describe(basename(file, '.test'), () => {
    runTestFile(file);
  });
}
