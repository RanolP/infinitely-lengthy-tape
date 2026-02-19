import type { Config } from '@react-router/dev/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(appRoot, 'workspace');

async function collectTapeRoutes(dirPath: string, relBase = ''): Promise<string[]> {
  let entries: Awaited<ReturnType<typeof fs.readdir>>;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }

  const routes: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;

    if (entry.isDirectory()) {
      routes.push(...(await collectTapeRoutes(path.join(dirPath, entry.name), relPath)));
      continue;
    }

    if (!entry.name.endsWith('.tape')) continue;

    routes.push('/' + relPath.replace(/\.tape$/, ''));
  }

  return routes;
}

export default {
  appDirectory: 'src',
  ssr: false,
  buildDirectory: 'dist',
  basename: process.env.VITE_BASE_PATH || '/',
  prerender: async () => {
    const routes = await collectTapeRoutes(workspaceRoot);
    return ['/', ...routes];
  },
} satisfies Config;
