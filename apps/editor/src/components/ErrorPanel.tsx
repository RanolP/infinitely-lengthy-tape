import type { ParseErrorInfo } from '@edhit/editor-core';
import type { TypeError } from '@edhit/language';

interface ErrorPanelProps {
  parseErrors: ParseErrorInfo[];
  typeErrors: TypeError[];
}

export function ErrorPanel({ parseErrors, typeErrors }: ErrorPanelProps) {
  if (parseErrors.length === 0 && typeErrors.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-lg border border-neutral-700 bg-neutral-800 p-4 text-sm">
      {parseErrors.map((err, i) => (
        <div key={`parse-${i}`} className="flex gap-2 text-amber-400">
          <span className="shrink-0 font-mono text-neutral-500">
            {err.pos.line}:{err.pos.col}
          </span>
          <span>{err.message}</span>
        </div>
      ))}
      {typeErrors.map((err, i) => (
        <div key={`type-${i}`} className="flex gap-2 text-red-400">
          <span className="shrink-0 font-mono text-neutral-500">
            {err.span.start.line}:{err.span.start.col}
          </span>
          <span>{err.message}</span>
        </div>
      ))}
    </div>
  );
}
