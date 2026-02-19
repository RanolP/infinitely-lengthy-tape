import { Hono } from 'hono';
import { getRequestListener } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import * as http from 'node:http';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { $typst } from '@myriaddreamin/typst.ts/contrib/snippet';

const app = new Hono();
const root = path.resolve(process.env.TAPE_ROOT || './workspace');
const typstCacheRoot = path.resolve(root, '.cache', 'typst');

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  title?: string;
  children?: FileNode[];
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
        const parsed = JSON.parse(raw);
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

function safePath(filePath: string): string | null {
  const full = path.resolve(root, filePath);
  if (!full.startsWith(root + path.sep) && full !== root) return null;
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

async function renderTypstSvg(source: string): Promise<string> {
  const document = [typstPrelude(), toTypstMathSource(source)].join('\n');
  const rendered = await $typst.svg({ mainContent: document });
  return rendered.replace(
    '<svg',
    '<svg style="height:0.9em;width:auto;display:inline-block;vertical-align:-0.12em;overflow:visible"',
  );
}

async function purgeTypstCache(): Promise<void> {
  await fs.rm(typstCacheRoot, { recursive: true, force: true });
  await fs.mkdir(typstCacheRoot, { recursive: true });
}

// --- API routes ---

app.get('/api/tree', async (c) => {
  try {
    await fs.mkdir(root, { recursive: true });
    const tree = await scanDir(root, '');
    return c.json(tree);
  } catch {
    return c.json({ error: 'Failed to scan directory' }, 500);
  }
});

app.get('/api/file', async (c) => {
  const filePath = c.req.query('path');
  if (!filePath) return c.json({ error: 'Missing path' }, 400);

  const full = safePath(filePath);
  if (!full) return c.json({ error: 'Invalid path' }, 400);

  try {
    const content = await fs.readFile(full, 'utf-8');
    return c.json(JSON.parse(content));
  } catch {
    return c.json({ error: 'File not found' }, 404);
  }
});

app.put('/api/file', async (c) => {
  const filePath = c.req.query('path');
  if (!filePath) return c.json({ error: 'Missing path' }, 400);

  const full = safePath(filePath);
  if (!full) return c.json({ error: 'Invalid path' }, 400);

  const body = await c.req.json();
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(body, null, 2));
  return c.json({ ok: true });
});

app.post('/api/file', async (c) => {
  const body = await c.req.json<{ path: string }>();
  if (!body.path) return c.json({ error: 'Missing path' }, 400);

  const full = safePath(body.path);
  if (!full) return c.json({ error: 'Invalid path' }, 400);

  const baseName = path.basename(body.path, '.tape');
  const initial = { title: baseName, cells: [{ id: crypto.randomUUID(), type: 'code', content: '' }] };
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, JSON.stringify(initial, null, 2));
  return c.json({ ok: true });
});

app.delete('/api/file', async (c) => {
  const filePath = c.req.query('path');
  if (!filePath) return c.json({ error: 'Missing path' }, 400);

  const full = safePath(filePath);
  if (!full) return c.json({ error: 'Invalid path' }, 400);

  try {
    await fs.unlink(full);
    return c.json({ ok: true });
  } catch {
    return c.json({ error: 'File not found' }, 404);
  }
});

app.post('/api/mkdir', async (c) => {
  const body = await c.req.json<{ path: string }>();
  if (!body.path) return c.json({ error: 'Missing path' }, 400);

  const full = safePath(body.path);
  if (!full) return c.json({ error: 'Invalid path' }, 400);

  await fs.mkdir(full, { recursive: true });
  return c.json({ ok: true });
});

app.post('/api/rename', async (c) => {
  const body = await c.req.json<{ from: string; to: string }>();
  if (!body.from || !body.to) return c.json({ error: 'Missing from/to' }, 400);

  const fullFrom = safePath(body.from);
  const fullTo = safePath(body.to);
  if (!fullFrom || !fullTo) return c.json({ error: 'Invalid path' }, 400);

  await fs.mkdir(path.dirname(fullTo), { recursive: true });
  await fs.rename(fullFrom, fullTo);
  return c.json({ ok: true });
});

app.post('/api/typst/render', async (c) => {
  const body = await c.req.json<{ source?: string }>().catch(() => ({}));
  const source = (body.source ?? '').trim();
  if (!source) return c.json({ error: 'Missing source' }, 400);

  const key = typstCacheKey(source);
  const cachedPath = path.join(typstCacheRoot, `${key}.svg`);

  try {
    const cachedSvg = await fs.readFile(cachedPath, 'utf-8');
    return c.json({ key, cached: true, svg: cachedSvg });
  } catch {
    // cache miss
  }

  try {
    const svg = await renderTypstSvg(source);
    await fs.mkdir(typstCacheRoot, { recursive: true });
    await fs.writeFile(cachedPath, svg, 'utf-8');
    return c.json({ key, cached: false, svg });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Typst render failed';
    return c.json({ error: message }, 500);
  }
});

// --- Server startup ---

const isDev = process.env.NODE_ENV !== 'production';
const port = Number(process.env.PORT) || 3001;

async function start() {
  const honoListener = getRequestListener(app.fetch);
  await purgeTypstCache();
  const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const viteConfigFile = path.resolve(appRoot, 'vite.config.ts');

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      root: appRoot,
      configFile: viteConfigFile,
      server: { middlewareMode: true },
      appType: 'spa',
    });

    const server = http.createServer((req, res) => {
      if (req.url?.startsWith('/api/')) {
        honoListener(req, res);
      } else {
        vite.middlewares(req, res);
      }
    });

    // Forward WebSocket upgrades to Vite for HMR
    server.on('upgrade', (req, socket, head) => {
      if (vite.ws) {
        vite.ws.handleUpgrade(req, socket, head);
      }
    });

    server.listen(port, () => {
      console.log(`Dev server running on http://localhost:${port}`);
      console.log(`Workspace: ${root}`);
    });
  } else {
    app.get('/*', serveStatic({ root: './dist' }));
    // SPA fallback: serve index.html for non-asset routes
    app.get('/*', async (c) => {
      const html = await fs.readFile(path.resolve('./dist/index.html'), 'utf-8');
      return c.html(html);
    });
    const server = http.createServer(getRequestListener(app.fetch));
    server.listen(port, () => {
      console.log(`Server running on http://localhost:${port}`);
      console.log(`Workspace: ${root}`);
    });
  }
}

start();
