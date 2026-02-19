import rendererWasmUrl from '@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm?url';
import compilerWasmUrl from '@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm?url';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

type TypstSnippetModule = {
  $typst?: {
    setCompilerInitOptions?: (options: { getModule: () => string }) => void;
    setRendererInitOptions?: (options: { getModule: () => string }) => void;
    svg?: (opts: { mainContent: string }) => Promise<string>;
  };
};

let typstSnippetModulePromise: Promise<TypstSnippetModule> | null = null;
let typstSnippetConfigured = false;

async function getTypstSnippetModule(): Promise<TypstSnippetModule> {
  if (!typstSnippetModulePromise) {
    typstSnippetModulePromise = import(
      /* @vite-ignore */ '@myriaddreamin/typst.ts/contrib/snippet'
    ) as Promise<TypstSnippetModule>;
  }
  const mod = await typstSnippetModulePromise;

  if (!typstSnippetConfigured && mod.$typst) {
    mod.$typst.setCompilerInitOptions?.({
      getModule: () => compilerWasmUrl,
    });
    mod.$typst.setRendererInitOptions?.({
      getModule: () => rendererWasmUrl,
    });
    typstSnippetConfigured = true;
  }

  return mod;
}

async function tryRenderWithTypstTs(source: string): Promise<string | null> {
  const mod = await getTypstSnippetModule().catch(() => null);
  if (!mod?.$typst?.svg) return null;

  const mathSource = source.trim().startsWith('$') && source.trim().endsWith('$')
    ? source.trim()
    : `$${source.trim()}$`;
  const prelude = [
    '#set page(width: auto, height: auto, margin: 0pt)',
    '#set text(font: "New Computer Modern", size: 1em, fill: rgb("#e5e5e5"))',
    '#set par(leading: 0.85em)',
  ].join('\n');
  const document = [
    prelude,
    mathSource,
  ].join('\n');

  const rendered = await mod.$typst.svg({ mainContent: document });
  if (typeof rendered !== 'string') return null;

  // Inline math scale + baseline alignment
  return rendered.replace(
    '<svg',
    '<svg style="height:0.9em;width:auto;display:inline-block;vertical-align:-0.12em;overflow:visible"',
  );
}

async function tryRenderWithServerCache(source: string): Promise<string | null> {
  try {
    const response = await fetch('/api/typst/render', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ source }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { svg?: unknown };
    return typeof payload.svg === 'string' ? payload.svg : null;
  } catch {
    return null;
  }
}

export async function renderTypst(source: string): Promise<string> {
  const fromCache = await tryRenderWithServerCache(source);
  if (fromCache) return fromCache;

  const rendered = await tryRenderWithTypstTs(source);
  if (rendered) return rendered;
  return `<span class="typst-render-fallback">${escapeHtml(source)}</span>`;
}
