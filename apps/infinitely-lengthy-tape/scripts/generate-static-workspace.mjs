import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { $typst } from '@myriaddreamin/typst.ts/contrib/snippet';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(appRoot, 'workspace');
const outputRoot = path.resolve(appRoot, 'public', 'static-workspace');
const require = createRequire(import.meta.url);
const compilerWasmPath = require.resolve('@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm');
const rendererWasmPath = require.resolve('@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm');
const typstStats = { candidates: 0, rendered: 0, failed: 0 };
const typstSvgCache = new Map();
let typstLastError = null;

$typst.setCompilerInitOptions?.({ getModule: () => fs.readFile(compilerWasmPath) });
$typst.setRendererInitOptions?.({ getModule: () => fs.readFile(rendererWasmPath) });

function decodeHtmlEntities(text) {
  return text
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function toTypstMathSource(source) {
  const trimmed = source.trim();
  if (trimmed.startsWith('$') && trimmed.endsWith('$')) return trimmed;
  return `$${trimmed}$`;
}

function typstPrelude() {
  return [
    '#set page(width: auto, height: auto, margin: 0pt)',
    '#set text(font: "New Computer Modern", size: 1em, fill: rgb("#e5e5e5"))',
    '#set par(leading: 0.85em)',
  ].join('\n');
}

function withTypstInlineSvgClass(svg) {
  return svg.replace(/<svg\b([^>]*)>/, (fullTag, attrs) => {
    if (/\bclass\s*=/.test(attrs)) {
      return `<svg${attrs.replace(/\bclass=(["'])(.*?)\1/, (_match, quote, value) => `class=${quote}${value} typst-inline-svg${quote}`)}>`;
    }
    return `<svg class="typst-inline-svg"${attrs}>`;
  });
}

async function renderTypstSvg(source) {
  const key = source.trim();
  if (typstSvgCache.has(key)) return typstSvgCache.get(key);

  const document = [typstPrelude(), toTypstMathSource(source)].join('\n');
  const rendered = await $typst.svg({ mainContent: document });
  const svg = withTypstInlineSvgClass(rendered);
  typstSvgCache.set(key, svg);
  return svg;
}

async function hydrateTypstInlineInHtml(html) {
  const spanPattern = /<span\b([^>]*\bdata-typst-inline\b[^>]*)>(.*?)<\/span>/gs;
  let output = '';
  let lastIndex = 0;
  let replaced = 0;
  let failed = 0;
  let match;

  while ((match = spanPattern.exec(html)) !== null) {
    const [full, attrs] = match;
    const sourceMatch = attrs.match(/\bdata-typst-source=(["'])(.*?)\1/s);
    if (!sourceMatch) continue;
    const source = decodeHtmlEntities(sourceMatch[2] ?? '').trim();
    if (!source) continue;
    typstStats.candidates += 1;

    let svg;
    try {
      svg = await renderTypstSvg(source);
    } catch (error) {
      typstLastError = error instanceof Error ? error.message : String(error);
      failed += 1;
      typstStats.failed += 1;
      continue;
    }

    const encodedSvg = encodeURIComponent(svg);
    const attrsWithoutSvg = attrs.replace(/\s*\bdata-typst-svg=(["']).*?\1/gs, '');
    const nextAttrs = `${attrsWithoutSvg} data-typst-svg="${encodedSvg}"`;
    const replacement = `<span${nextAttrs}>${svg}</span>`;

    output += html.slice(lastIndex, match.index);
    output += replacement;
    lastIndex = match.index + full.length;
    replaced += 1;
    typstStats.rendered += 1;
  }

  if (replaced === 0) return { html, replaced: 0, failed };
  output += html.slice(lastIndex);
  return { html: output, replaced, failed };
}

async function hydrateTypstCellsInFile(file) {
  if (!file || !Array.isArray(file.cells)) return { file, replaced: 0, failed: 0 };

  let replaced = 0;
  let failed = 0;
  const cells = [];
  for (const cell of file.cells) {
    if (cell?.type !== 'prose' || typeof cell.content !== 'string') {
      cells.push(cell);
      continue;
    }
    const hydrated = await hydrateTypstInlineInHtml(cell.content);
    replaced += hydrated.replaced;
    failed += hydrated.failed;
    cells.push({ ...cell, content: hydrated.html });
  }

  return { file: { ...file, cells }, replaced, failed };
}

async function scanDir(dirPath, relBase) {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const nodes = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      const children = await scanDir(path.join(dirPath, entry.name), relPath);
      nodes.push({ name: entry.name, path: relPath, type: 'directory', children });
      continue;
    }

    if (!entry.name.endsWith('.tape')) continue;

    let title;
    try {
      const raw = await fs.readFile(path.join(dirPath, entry.name), 'utf-8');
      const parsed = JSON.parse(raw);
      if (parsed.title && typeof parsed.title === 'string') title = parsed.title;
    } catch {
      // ignore invalid files
    }

    nodes.push({
      name: entry.name,
      path: relPath,
      type: 'file',
      ...(title ? { title } : {}),
    });
  }

  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

async function collectFiles(nodes, result) {
  let typstReplaced = 0;
  let typstFailed = 0;

  for (const node of nodes) {
    if (node.type === 'directory') {
      const child = await collectFiles(node.children ?? [], result);
      typstReplaced += child.replaced;
      typstFailed += child.failed;
      continue;
    }

    const fullPath = path.join(workspaceRoot, node.path);
    try {
      const raw = await fs.readFile(fullPath, 'utf-8');
      const parsed = JSON.parse(raw);
      const hydrated = await hydrateTypstCellsInFile(parsed);
      typstReplaced += hydrated.replaced;
      typstFailed += hydrated.failed;
      result[node.path] = hydrated.file;
    } catch {
      // keep going
    }
  }

  return { replaced: typstReplaced, failed: typstFailed };
}

async function main() {
  const tree = await scanDir(workspaceRoot, '');
  const files = {};
  const typstResult = await collectFiles(tree, files);

  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.writeFile(path.join(outputRoot, 'tree.json'), JSON.stringify(tree));
  await fs.writeFile(path.join(outputRoot, 'files.json'), JSON.stringify(files));

  console.log(
    `Generated static workspace: ${Object.keys(files).length} files, typst inline rendered: ${typstResult.replaced}/${typstStats.candidates}`,
  );
  if (typstResult.failed > 0) {
    console.warn(`Typst inline render failed: ${typstResult.failed}`);
    if (typstLastError) {
      console.warn(`Last Typst error: ${typstLastError}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
