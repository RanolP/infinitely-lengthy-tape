import type { CellAnalysisSlice } from '../../model/types.js';

interface CellOutputProps {
  slice: CellAnalysisSlice | null;
  hover: { text: string; type: string } | null;
}

export function CellOutput({ slice, hover }: CellOutputProps) {
  const hasDefs = slice && slice.defs.length > 0;
  const hasParseErrors = slice && slice.parseErrors.length > 0;
  const hasTypeErrors = slice && slice.typeErrors.length > 0;
  const hasHover = hover !== null;

  if (!hasDefs && !hasParseErrors && !hasTypeErrors && !hasHover) return null;

  return (
    <div className="cell-output font-mono text-sm">
      {hasHover && (
        <div>
          <span className="font-bold text-sky-300">{hover.text}</span>
          <span className="text-neutral-400"> : </span>
          <span className="text-green-400">{hover.type}</span>
        </div>
      )}
      {hasDefs &&
        slice.defs.map((def, i) => (
          <div key={i}>
            <span className="font-bold text-sky-300">{def.name}</span>
            <span className="text-neutral-400"> : </span>
            <span className="text-green-400">{def.type}</span>
            {def.constructors.map((ctor, j) => (
              <div key={j} className="ml-4">
                <span className="text-amber-400">.{ctor.name}</span>
                <span className="text-neutral-400"> : </span>
                <span className="text-green-400">{ctor.type}</span>
              </div>
            ))}
          </div>
        ))}
      {hasParseErrors &&
        slice.parseErrors.map((err, i) => (
          <div key={`pe-${i}`} className="flex gap-2 text-amber-400">
            <span className="shrink-0 text-neutral-500">
              {err.pos.line}:{err.pos.col}
            </span>
            <span>{err.message}</span>
          </div>
        ))}
      {hasTypeErrors &&
        slice.typeErrors.map((err, i) => (
          <div key={`te-${i}`} className="flex gap-2 text-red-400">
            <span className="shrink-0 text-neutral-500">
              {err.span.start.line}:{err.span.start.col}
            </span>
            <span>{err.message}</span>
          </div>
        ))}
    </div>
  );
}
