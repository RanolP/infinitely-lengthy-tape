import { useEffect, useRef } from 'react';
import type { CompletionItem } from '@edhit/editor-core';

interface CompletionMenuProps {
  items: CompletionItem[];
  selectedIndex: number;
  coords: { top: number; left: number } | null;
  onAccept: () => void;
  onDismiss: () => void;
}

export function CompletionMenu({ items, selectedIndex, coords, onAccept, onDismiss }: CompletionMenuProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.children[selectedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!coords || items.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="fixed z-50 max-h-48 overflow-y-auto rounded border border-neutral-600 bg-neutral-800 shadow-lg"
      style={{ top: coords.top + 4, left: coords.left }}
    >
      {items.map((item, i) => (
        <div
          key={`${item.label}-${i}`}
          className={`flex cursor-pointer items-center gap-2 px-3 py-1 text-sm ${
            i === selectedIndex ? 'bg-neutral-600 text-white' : 'text-neutral-300'
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            onAccept();
          }}
        >
          <span className="font-mono">{item.label}</span>
          {item.detail && <span className="text-xs text-neutral-500">{item.detail}</span>}
        </div>
      ))}
    </div>
  );
}
