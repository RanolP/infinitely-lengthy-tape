import { useCallback, useEffect } from 'react';
import { Routes, Route, useParams, useNavigate } from 'react-router';
import { Sidebar } from '../features/file-tree/components/sidebar.js';
import { PageEditor } from '../features/page/components/page-editor.js';
import { useFileTree } from '../features/file-tree/hooks/use-file-tree.js';
import { usePageNotebook } from '../features/page/hooks/use-page-notebook.js';

const isReadOnly = import.meta.env.VITE_READ_ONLY === 'true';

function pathToRoute(filePath: string): string {
  return '/' + filePath.replace(/\.tape$/, '');
}

function routeToPath(routePath: string): string {
  const trimmed = routePath.startsWith('/') ? routePath.slice(1) : routePath;
  return trimmed ? trimmed + '.tape' : '';
}

function PageView({ fileTree }: { fileTree: ReturnType<typeof useFileTree> }) {
  const params = useParams();
  const navigate = useNavigate();
  const filePath = routeToPath(params['*'] || '');

  const handlePathChanged = useCallback(
    (newPath: string) => {
      navigate(pathToRoute(newPath), { replace: true });
      fileTree.refresh();
    },
    [navigate, fileTree],
  );

  const notebook = usePageNotebook(filePath || null, handlePathChanged, isReadOnly);

  useEffect(() => {
    if (filePath && notebook.title) {
      fileTree.updateTitle(filePath, notebook.title);
    }
  }, [filePath, notebook.title, fileTree.updateTitle]);

  if (!filePath) {
    return (
      <div className="app-empty">
        <h1 className="text-xl font-bold text-neutral-400">infinitely lengthy tape</h1>
        <p className="mt-2 text-sm text-neutral-500">Select a file or create a new one to begin.</p>
      </div>
    );
  }

  return   <PageEditor notebook={notebook} filePath={filePath} onRefresh={fileTree.refresh} readOnly={isReadOnly} />;
}

export function App() {
  const fileTree = useFileTree();
  const navigate = useNavigate();

  const selectedPath = routeToPath(location.pathname);

  const handleSelectFile = useCallback(
    (path: string) => {
      navigate(pathToRoute(path));
    },
    [navigate],
  );

  const handleCreateFile = useCallback(
    async (path: string) => {
      await fileTree.create(path);
      navigate(pathToRoute(path));
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
      <Sidebar
        readOnly={isReadOnly}
        tree={fileTree.tree}
        loading={fileTree.loading}
        selectedPath={selectedPath || null}
        onSelectFile={handleSelectFile}
        onCreateFile={handleCreateFile}
        onCreateDir={fileTree.mkdir}
        onDeleteFile={handleDeleteFile}
        onRefresh={fileTree.refresh}
      />
      <main className="app-main">
        <Routes>
          <Route path="*" element={<PageView fileTree={fileTree} />} />
        </Routes>
      </main>
    </div>
  );
}
