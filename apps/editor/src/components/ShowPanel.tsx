import type { DefInfo } from '@edhit/editor-core';

interface ShowPanelProps {
  def: DefInfo | null;
}

export function ShowPanel({ def }: ShowPanelProps) {
  if (def === null) {
    return null;
  }

  return (
    <div className="mt-4 rounded-lg border border-neutral-700 bg-neutral-800 p-4 font-mono text-sm">
      <div>
        <span className="font-bold text-sky-300">{def.name}</span>
        <span className="text-neutral-400"> : </span>
        <span className="text-green-400">{def.type}</span>
        {def.value !== null && (
          <>
            <span className="text-neutral-400"> = </span>
            <span className="text-neutral-200">{def.value}</span>
          </>
        )}
      </div>
      {def.constructors.map((ctor, j) => (
        <div key={j} className="ml-4">
          <span className="text-amber-400">.{ctor.name}</span>
          <span className="text-neutral-400"> : </span>
          <span className="text-green-400">{ctor.type}</span>
        </div>
      ))}
    </div>
  );
}
