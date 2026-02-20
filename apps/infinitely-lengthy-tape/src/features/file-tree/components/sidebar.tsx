import { useState, useCallback } from 'react';
import { Link } from 'react-router';
import type { FileNode } from '../../../shared/api/tape-api.js';

interface SidebarProps {
  tree: FileNode[];
  loading: boolean;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onCreateFile: (path: string) => void;
  onCreateDir: (path: string) => void;
  onDeleteFile: (path: string) => void;
  onRefresh: () => void;
  readOnly: boolean;
  className?: string;
}

function TreeNode({
  node,
  depth,
  selectedPath,
  onSelectFile,
  onDeleteFile,
  readOnly,
}: {
  node: FileNode;
  depth: number;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onDeleteFile: (path: string) => void;
  readOnly: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const isSelected = node.path === selectedPath;
  const isDir = node.type === 'directory';
  const displayName = node.title || node.name.replace(/\.tape$/, '');
  const routePath = '/' + node.path.replace(/\.tape$/, '');

  if (isDir) {
    return (
      <details
        className={`sidebar-item ${isSelected ? 'sidebar-item-selected' : ''}`}
        open={expanded}
        onToggle={(event) => setExpanded((event.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="sidebar-item-button sidebar-item-summary" style={{ paddingLeft: `${depth * 16 + 8}px` }}>
          <span className="text-neutral-500">{expanded ? '▾' : '▸'}</span>
          <span>{displayName}</span>
        </summary>
        {node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelectFile={onSelectFile}
                onDeleteFile={onDeleteFile}
                readOnly={readOnly}
              />
            ))}
          </div>
        )}
      </details>
    );
  }

  return (
    <div>
      <div
        className={`sidebar-item ${isSelected ? 'sidebar-item-selected' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <Link className="sidebar-item-button" to={routePath} onClick={() => onSelectFile(node.path)}>
          <span className="text-neutral-500">◇</span>
          <span>{displayName}</span>
        </Link>
        {!readOnly && (
          <button
            type="button"
            className="sidebar-delete"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteFile(node.path);
            }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

export function Sidebar({
  tree,
  loading,
  selectedPath,
  onSelectFile,
  onCreateFile,
  onCreateDir,
  onDeleteFile,
  onRefresh,
  readOnly,
  className,
}: SidebarProps) {
  const [newName, setNewName] = useState('');
  const [showNew, setShowNew] = useState<'file' | 'dir' | null>(null);

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return;
    if (showNew === 'file') {
      const name = newName.trim().endsWith('.tape') ? newName.trim() : `${newName.trim()}.tape`;
      onCreateFile(name);
    } else if (showNew === 'dir') {
      onCreateDir(newName.trim());
    }
    setNewName('');
    setShowNew(null);
  }, [newName, showNew, onCreateFile, onCreateDir]);

  return (
    <aside className={`sidebar ${className ?? ''}`.trim()}>
      <div className="sidebar-header">
        <h2 className="text-sm font-bold text-neutral-300">Files</h2>
        <div className="flex gap-1">
          {!readOnly && (
            <>
              <button
                type="button"
                onClick={() => setShowNew(showNew === 'file' ? null : 'file')}
                className="sidebar-action-btn"
                title="New file"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setShowNew(showNew === 'dir' ? null : 'dir')}
                className="sidebar-action-btn"
                title="New folder"
              >
                📁
              </button>
            </>
          )}
          {!readOnly && (
            <button type="button" onClick={onRefresh} className="sidebar-action-btn" title="Refresh">
              ↻
            </button>
          )}
        </div>
      </div>

      {!readOnly && showNew && (
        <div className="sidebar-new-form">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setShowNew(null);
            }}
            placeholder={showNew === 'file' ? 'filename.tape' : 'folder-name'}
            className="sidebar-new-input"
            autoFocus
          />
        </div>
      )}

      <div className="sidebar-tree">
        {loading ? (
          <div className="px-3 py-2 text-sm text-neutral-500">Loading...</div>
        ) : tree.length === 0 ? (
          <div className="px-3 py-2 text-sm text-neutral-500">No files yet</div>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              depth={0}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              onDeleteFile={onDeleteFile}
              readOnly={readOnly}
            />
          ))
        )}
      </div>
    </aside>
  );
}
