import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(appRoot, 'workspace');
const outputRoot = path.resolve(appRoot, 'public', 'static-workspace');

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
  for (const node of nodes) {
    if (node.type === 'directory') {
      await collectFiles(node.children ?? [], result);
      continue;
    }

    const fullPath = path.join(workspaceRoot, node.path);
    try {
      const raw = await fs.readFile(fullPath, 'utf-8');
      result[node.path] = JSON.parse(raw);
    } catch {
      // keep going
    }
  }
}

async function main() {
  const tree = await scanDir(workspaceRoot, '');
  const files = {};
  await collectFiles(tree, files);

  await fs.rm(outputRoot, { recursive: true, force: true });
  await fs.mkdir(outputRoot, { recursive: true });
  await fs.writeFile(path.join(outputRoot, 'tree.json'), JSON.stringify(tree));
  await fs.writeFile(path.join(outputRoot, 'files.json'), JSON.stringify(files));

  console.log(`Generated static workspace: ${Object.keys(files).length} files`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
