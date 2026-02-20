import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { Sidebar } from '../features/file-tree/components/sidebar.js';
import { PageEditor } from '../features/page/components/page-editor.js';
import { useFileTree } from '../features/file-tree/hooks/use-file-tree.js';
import { usePageNotebook } from '../features/page/hooks/use-page-notebook.js';
import type { TapeLoaderData } from '../shared/api/tape-api.js';

const isReadOnly = import.meta.env.VITE_READ_ONLY === 'true';

function pathToRoute(filePath: string): string {
  return '/' + filePath.replace(/\.tape$/, '');
}

function routeToPath(routePath: string): string {
  const trimmed = routePath.startsWith('/') ? routePath.slice(1) : routePath;
  const normalized = trimmed.replace(/\/+$/g, '');
  return normalized ? `${normalized}.tape` : '';
}

interface AppProps {
  initialData?: TapeLoaderData;
}

export function App({ initialData }: AppProps) {
  const params = useParams();
  const navigate = useNavigate();
  const fileTree = useFileTree(initialData?.initialTree);

  const routePath = params['*'] || '';
  const filePath = routeToPath(routePath);
  const selectedPath = filePath || null;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handlePathChanged = useCallback(
    (newPath: string) => {
      navigate(pathToRoute(newPath), { replace: true });
      fileTree.refresh();
    },
    [navigate, fileTree],
  );

  const notebook = usePageNotebook(
    filePath || null,
    handlePathChanged,
    isReadOnly,
    initialData?.initialFilePath ?? null,
    initialData?.initialFile ?? null,
  );

  useEffect(() => {
    if (filePath && notebook.title && notebook.titlePath === filePath) {
      fileTree.updateTitle(filePath, notebook.title);
    }
  }, [filePath, notebook.title, notebook.titlePath, fileTree.updateTitle]);

  const handleSelectFile = useCallback(
    (_path: string) => {
      setIsDrawerOpen(false);
    },
    [],
  );

  const handleCreateFile = useCallback(
    async (path: string) => {
      await fileTree.create(path);
      navigate(pathToRoute(path));
      setIsDrawerOpen(false);
    },
    [fileTree, navigate],
  );

  const handleDeleteFile = useCallback(
    async (path: string) => {
      await fileTree.remove(path);
      if (selectedPath === path) {
        navigate('/');
      }
    },
    [fileTree, selectedPath, navigate],
  );

  return (
    <div className="app-layout">
      <button
        type="button"
        className="app-nav-toggle"
        onClick={() => setIsDrawerOpen(true)}
        aria-label="Open navigation drawer"
      >
        ☰
      </button>
      {isDrawerOpen && <button type="button" className="app-drawer-backdrop" onClick={() => setIsDrawerOpen(false)} aria-label="Close navigation drawer" />}
      <Sidebar
        className={isDrawerOpen ? 'sidebar-open' : ''}
        readOnly={isReadOnly}
        tree={fileTree.tree}
        loading={fileTree.loading}
        selectedPath={selectedPath}
        onSelectFile={handleSelectFile}
        onCreateFile={handleCreateFile}
        onCreateDir={fileTree.mkdir}
        onDeleteFile={handleDeleteFile}
        onRefresh={fileTree.refresh}
      />
      <main className="app-main">
        {!filePath ? (
          <div className="app-empty">
            <h1 className="text-xl font-bold text-neutral-400">infinitely lengthy tape</h1>
            <p className="mt-2 text-sm text-neutral-500">Select a file or create a new one to begin.</p>
          </div>
        ) : (
          <PageEditor notebook={notebook} filePath={filePath} onRefresh={fileTree.refresh} readOnly={isReadOnly} />
        )}
      </main>
    </div>
  );
}
