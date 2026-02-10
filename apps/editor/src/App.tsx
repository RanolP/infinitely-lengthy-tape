import { Editor } from './components/Editor.js';

export function App() {
  return (
    <div className="min-h-screen bg-neutral-900 p-8 text-white">
      <h1 className="mb-6 text-xl font-bold text-neutral-300">edhit</h1>
      <Editor />
    </div>
  );
}
