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

export async function fetchTree(): Promise<FileNode[]> {
  const res = await fetch('/api/tree');
  if (!res.ok) throw new Error('Failed to fetch tree');
  return res.json();
}

export async function fetchFile(path: string): Promise<TapeFile> {
  const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error('Failed to fetch file');
  return res.json();
}

export async function saveFile(path: string, data: TapeFile): Promise<void> {
  const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save file');
}

export async function createFile(path: string): Promise<void> {
  const res = await fetch('/api/file', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error('Failed to create file');
}

export async function deleteFile(path: string): Promise<void> {
  const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete file');
}

export async function renameFile(from: string, to: string): Promise<void> {
  const res = await fetch('/api/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to }),
  });
  if (!res.ok) throw new Error('Failed to rename file');
}

export async function createDirectory(path: string): Promise<void> {
  const res = await fetch('/api/mkdir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) throw new Error('Failed to create directory');
}
