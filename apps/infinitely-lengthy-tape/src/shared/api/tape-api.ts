export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  title?: string;
  children?: FileNode[];
}

export interface TapeFile {
  title?: string;
  cells: TapeCell[];
}

export interface TapeCell {
  id: string;
  type: 'code' | 'prose';
  content: string;
}

const isReadOnly = import.meta.env.VITE_READ_ONLY === 'true';

let staticTreePromise: Promise<FileNode[]> | null = null;
let staticFilesPromise: Promise<Record<string, TapeFile>> | null = null;

function staticDataUrl(file: string): string {
  return `${import.meta.env.BASE_URL}static-workspace/${file}`;
}

async function fetchStaticTree(): Promise<FileNode[]> {
  if (!staticTreePromise) {
    staticTreePromise = fetch(staticDataUrl('tree.json')).then((res) => {
      if (!res.ok) throw new Error('Failed to fetch static tree');
      return res.json();
    });
  }
  return staticTreePromise;
}

async function fetchStaticFiles(): Promise<Record<string, TapeFile>> {
  if (!staticFilesPromise) {
    staticFilesPromise = fetch(staticDataUrl('files.json')).then((res) => {
      if (!res.ok) throw new Error('Failed to fetch static files');
      return res.json();
    });
  }
  return staticFilesPromise;
}

export async function fetchTree(): Promise<FileNode[]> {
  if (isReadOnly) {
    return fetchStaticTree();
  }

  const res = await fetch('/api/tree');
  if (!res.ok) throw new Error('Failed to fetch tree');
  return res.json();
}

export async function fetchFile(path: string): Promise<TapeFile> {
  if (isReadOnly) {
    const files = await fetchStaticFiles();
    const file = files[path];
    if (!file) throw new Error('Failed to fetch file');
    return file;
  }

  const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error('Failed to fetch file');
  return res.json();
}

export async function saveFile(path: string, data: TapeFile): Promise<void> {
  if (isReadOnly) return;

  const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save file');
}

export async function createFile(path: string): Promise<void> {
  if (isReadOnly) return;

  const res = await fetch('/api/file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error('Failed to create file');
}

export async function deleteFile(path: string): Promise<void> {
  if (isReadOnly) return;

  const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete file');
}

export async function renameFile(from: string, to: string): Promise<void> {
  if (isReadOnly) return;

  const res = await fetch('/api/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to }),
  });
  if (!res.ok) throw new Error('Failed to rename file');
}

export async function createDirectory(path: string): Promise<void> {
  if (isReadOnly) return;

  const res = await fetch('/api/mkdir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error('Failed to create directory');
}
