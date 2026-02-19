import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const semanticHighlightKey = new PluginKey<DecorationSet>('semanticHighlight');

export const SemanticHighlight = Extension.create({
  name: 'semanticHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: semanticHighlightKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, set) {
            const newDecos = tr.getMeta(semanticHighlightKey);
            if (newDecos !== undefined) {
              return newDecos as DecorationSet;
            }
            return set.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return semanticHighlightKey.getState(state);
          },
        },
      }),
    ];
  },
});

interface LineEntry {
  sourceStart: number;
  pmStart: number;
}

export function buildLineMap(source: string): LineEntry[] {
  const lines = source.split('\n');
  const map: LineEntry[] = [];
  let sourceOffset = 0;
  let pmOffset = 1;
  for (const line of lines) {
    map.push({ sourceStart: sourceOffset, pmStart: pmOffset });
    sourceOffset += line.length + 1;
    pmOffset += line.length + 2;
  }
  return map;
}

export function offsetToPmPos(lineMap: LineEntry[], offset: number): number {
  for (let i = lineMap.length - 1; i >= 0; i--) {
    if (offset >= lineMap[i]!.sourceStart) {
      return lineMap[i]!.pmStart + (offset - lineMap[i]!.sourceStart);
    }
  }
  return 1;
}

export function pmPosToOffset(lineMap: LineEntry[], pmPos: number): number {
  for (let i = lineMap.length - 1; i >= 0; i--) {
    if (pmPos >= lineMap[i]!.pmStart) {
      return lineMap[i]!.sourceStart + (pmPos - lineMap[i]!.pmStart);
    }
  }
  return 0;
}
