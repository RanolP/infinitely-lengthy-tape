import { useState } from 'react';
import {
  NotebookContext,
  CodeCell,
  ProseCell,
  AddCellDivider,
  useEffectEvent,
  type NotebookContextValue,
} from '@edhit/notebook';
import type { PageNotebookState } from '../hooks/use-page-notebook.js';

interface PageEditorProps {
  notebook: PageNotebookState;
  filePath: string;
  onRefresh: () => void;
  readOnly: boolean;
}

export function PageEditor({ notebook: nb, filePath, onRefresh, readOnly }: PageEditorProps) {
  const [editingFilename, setEditingFilename] = useState(false);
  const [filenameInput, setFilenameInput] = useState('');

  const startFilenameEdit = useEffectEvent(() => {
    if (readOnly) return;
    const name = filePath.split('/').pop() || filePath;
    setFilenameInput(name.replace(/\.tape$/, ''));
    setEditingFilename(true);
  });

  const commitFilenameEdit = useEffectEvent(async () => {
    setEditingFilename(false);
    const trimmed = filenameInput.trim();
    if (!trimmed) return;
    const newPath = await nb.renameFileTo(trimmed);
    if (newPath) onRefresh();
  });

  const ctxValue: NotebookContextValue = { ...nb, readOnly };

  if (nb.loading) {
    return <div className="flex-1 flex items-center justify-center text-neutral-500">Loading...</div>;
  }

  const filename = filePath.split('/').pop()?.replace(/\.tape$/, '') || filePath;

  return (
    <div className="page-editor">
      <div className="page-header">
        <div className="page-header-titles">
          {readOnly ? (
            <div className="page-title-input" aria-readonly="true">
              {nb.title || 'Untitled'}
            </div>
          ) : (
            <input
              type="text"
              className="page-title-input"
              value={nb.title}
              onChange={(e) => nb.setTitle(e.target.value)}
              placeholder="Untitled"
            />
          )}
          <div className="page-filename-row">
            {!readOnly && editingFilename ? (
              <input
                type="text"
                className="page-filename-input"
                value={filenameInput}
                onChange={(e) => setFilenameInput(e.target.value)}
                onBlur={commitFilenameEdit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitFilenameEdit();
                  if (e.key === 'Escape') setEditingFilename(false);
                }}
                autoFocus
              />
            ) : readOnly ? (
              <span className="page-filename-display">{filename}.tape</span>
            ) : (
              <button
                type="button"
                className="page-filename-display"
                onClick={startFilenameEdit}
                title="Click to rename file"
              >
                {filename}.tape
              </button>
            )}
            {!readOnly && nb.dirty && <span className="text-xs text-amber-400">unsaved</span>}
          </div>
        </div>
      </div>

      <NotebookContext value={ctxValue}>
        <div className="notebook">
          {nb.cells.map((cell) => (
            <div key={cell.id}>
              {!readOnly && cell === nb.cells[0] && (
                <AddCellDivider
                  onAddCode={() => nb.addCell(null, 'code')}
                  onAddProse={() => nb.addCell(null, 'prose')}
                />
              )}
              {cell.type === 'code' ? (
                <CodeCell
                  cellId={cell.id}
                  initialContent={cell.content}
                  isFocused={nb.focusedCellId === cell.id}
                />
              ) : (
                <ProseCell
                  cellId={cell.id}
                  initialContent={cell.content}
                  isFocused={nb.focusedCellId === cell.id}
                />
              )}
{!readOnly && (
                <AddCellDivider
                  onAddCode={() => nb.addCell(cell.id, 'code')}
                  onAddProse={() => nb.addCell(cell.id, 'prose')}
                />
              )}
            </div>
          ))}
        </div>
      </NotebookContext>
    </div>
  );
}
