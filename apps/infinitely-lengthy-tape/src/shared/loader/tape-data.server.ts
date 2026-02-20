import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileNode, TapeFile, TapeLoaderData } from '../api/tape-api.js';

const appRoot = process.cwd();
const staticWorkspaceRoot = path.join(appRoot, 'public', 'static-workspace');

let treePromise: Promise<FileNode[]> | null = null;
let filesPromise: Promise<Record<string, TapeFile>> | null = null;

function loadTree(): Promise<FileNode[]> {
  if (!treePromise) {
    treePromise = fs
      .readFile(path.join(staticWorkspaceRoot, 'tree.json'), 'utf-8')
      .then((raw) => JSON.parse(raw) as FileNode[])
      .catch(() => []);
  }
  return treePromise;
}

function loadFiles(): Promise<Record<string, TapeFile>> {
  if (!filesPromise) {
    filesPromise = fs
      .readFile(path.join(staticWorkspaceRoot, 'files.json'), 'utf-8')
      .then((raw) => JSON.parse(raw) as Record<string, TapeFile>)
      .catch(() => ({}));
  }
  return filesPromise;
}

function routePathToFilePath(splat: string | undefined): string | null {
  if (!splat) return null;
  const trimmed = splat.replace(/^\/+|\/+$/g, '');
  return trimmed ? `${trimmed}.tape` : null;
}

export async function loadTapeRouteData(splat: string | undefined): Promise<TapeLoaderData> {
  const [initialTree, files] = await Promise.all([loadTree(), loadFiles()]);
  const initialFilePath = routePathToFilePath(splat);
  const initialFile = initialFilePath ? (files[initialFilePath] ?? null) : null;
  return { initialTree, initialFilePath, initialFile };
}
