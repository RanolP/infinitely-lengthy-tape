import { useState, useCallback, useEffect } from 'react';
import { fetchTree, createFile, deleteFile, createDirectory, type FileNode } from '../../../shared/api/tape-api.js';

export interface FileTreeState {
  tree: FileNode[];
  loading: boolean;
  refresh: () => void;
  create: (path: string) => Promise<void>;
  remove: (path: string) => Promise<void>;
  mkdir: (path: string) => Promise<void>;
  updateTitle: (path: string, title: string) => void;
}

function updateNodeTitle(nodes: FileNode[], path: string, title: string): FileNode[] {
  return nodes.map((node) => {
    if (node.path === path) return { ...node, title };
    if (node.children) return { ...node, children: updateNodeTitle(node.children, path, title) };
    return node;
  });
}

export function useFileTree(): FileTreeState {
  const [tree, setTree] = useState<FileNode[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    fetchTree()
      .then(setTree)
      .catch(() => setTree([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (path: string) => {
      await createFile(path);
      refresh();
    },
    [refresh],
  );

  const remove = useCallback(
    async (path: string) => {
      await deleteFile(path);
      refresh();
    },
    [refresh],
  );

  const mkdir = useCallback(
    async (path: string) => {
      await createDirectory(path);
      refresh();
    },
    [refresh],
  );

  const updateTitle = useCallback((path: string, title: string) => {
    setTree((prev) => updateNodeTitle(prev, path, title));
  }, []);

  return { tree, loading, refresh, create, remove, mkdir, updateTitle };
}
