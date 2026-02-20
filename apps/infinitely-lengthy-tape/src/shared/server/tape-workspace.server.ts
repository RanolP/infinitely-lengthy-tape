import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { $typst } from '@myriaddreamin/typst.ts/contrib/snippet';
import type { FileNode, TapeFile } from '../api/tape-api.js';

const workspaceRoot = path.resolve(process.env.TAPE_ROOT || './workspace');
const typstCacheRoot = path.resolve(workspaceRoot, '.cache', 'typst');

function safePath(filePath: string): string | null {
  const full = path.resolve(workspaceRoot, filePath);
  if (!full.startsWith(workspaceRoot + path.sep) && full !== workspaceRoot) return null;
  return full;
}

function toTypstMathSource(source: string): string {
  const trimmed = source.trim();
  if (trimmed.startsWith('$') && trimmed.endsWith('$')) return trimmed;
  return `$${trimmed}$`;
}

function typstPrelude(): string {
  return [
    '#set page(width: auto, height: auto, margin: 0pt)',
    '#set text(font: "New Computer Modern", size: 1em, fill: rgb("#e5e5e5"))',
    '#set par(leading: 0.85em)',
  ].join('\n');
}

function typstCacheKey(source: string): string {
  return createHash('sha256')
    .update('typst-inline-v2\n')
    .update(typstPrelude())
    .update('\n')
    .update(toTypstMathSource(source))
    .digest('hex');
}

function withTypstInlineSvgClass(svg: string): string {
  return svg.replace(/<svg\b([^>]*)>/, (_fullTag, attrs: string) => {
    if (/\bclass\s*=/.test(attrs)) {
      return `<svg${attrs.replace(/\bclass=(["'])(.*?)\1/, (_match, quote: string, value: string) => `class=${quote}${value} typst-inline-svg${quote}`)}>`;
    }
    return `<svg class="typst-inline-svg"${attrs}>`;
  });
}

async function scanDir(dirPath: string, relBase: string): Promise<FileNode[]> {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes: FileNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const children = await scanDir(path.join(dirPath, entry.name), relPath);
      nodes.push({ name: entry.name, path: relPath, type: 'directory', children });
    } else if (entry.name.endsWith('.tape')) {
      let title: string | undefined;
      try {
        const raw = await fs.readFile(path.join(dirPath, entry.name), 'utf-8');
        const parsed = JSON.parse(raw) as { title?: string };
        if (parsed.title) title = parsed.title;
      } catch {
        // ignore unreadable files
      }
      nodes.push({ name: entry.name, path: relPath, type: 'file', title });
    }
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function getTree(): Promise<FileNode[]> {
  await fs.mkdir(workspaceRoot, { recursive: true });
  return scanDir(workspaceRoot, '');
}

export async function getFile(filePath: string): Promise<TapeFile | null> {
  const full = safePath(filePath);
  if (!full) return null;

  try {
    const content = await fs.readFile(full, 'utf-8');
    return JSON.parse(content) as TapeFile;
  } catch {
    return null;
  }
}

export async function putFile(filePath: string, file: TapeFile): Promise<boolean> {
  const full = safePath(filePath);
  if (!full) return false;
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(file, null, 2));
  return true;
}

export async function postFile(filePath: string): Promise<boolean> {
  const full = safePath(filePath);
  if (!full) return false;

  const baseName = path.basename(filePath, '.tape');
  const initial: TapeFile = { title: baseName, cells: [{ id: crypto.randomUUID(), type: 'code', content: '' }] };
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(initial, null, 2));
  return true;
}

export async function removeFile(filePath: string): Promise<boolean> {
  const full = safePath(filePath);
  if (!full) return false;
  try {
    await fs.unlink(full);
    return true;
  } catch {
    return false;
  }
}

export async function renamePath(from: string, to: string): Promise<boolean> {
  const fullFrom = safePath(from);
  const fullTo = safePath(to);
  if (!fullFrom || !fullTo) return false;
  await fs.mkdir(path.dirname(fullTo), { recursive: true });
  await fs.rename(fullFrom, fullTo);
  return true;
}

export async function makeDirectory(dirPath: string): Promise<boolean> {
  const full = safePath(dirPath);
  if (!full) return false;
  await fs.mkdir(full, { recursive: true });
  return true;
}

export async function renderTypstCached(source: string): Promise<{ key: string; cached: boolean; svg: string }> {
  const key = typstCacheKey(source);
  const cachedPath = path.join(typstCacheRoot, `${key}.svg`);

  try {
    const cachedSvg = await fs.readFile(cachedPath, 'utf-8');
    return { key, cached: true, svg: cachedSvg };
  } catch {
    // cache miss
  }

  const document = [typstPrelude(), toTypstMathSource(source)].join('\n');
  const rendered = await $typst.svg({ mainContent: document });
  const svg = withTypstInlineSvgClass(rendered);

  await fs.mkdir(typstCacheRoot, { recursive: true });
  await fs.writeFile(cachedPath, svg, 'utf-8');
  return { key, cached: false, svg };
}
