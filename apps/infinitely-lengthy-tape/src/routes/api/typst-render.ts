import { renderTypstCached } from '../../shared/server/tape-workspace.server.js';

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = (await request.json().catch(() => ({}))) as { source?: string };
  const source = (body.source ?? '').trim();
  if (!source) return Response.json({ error: 'Missing source' }, { status: 400 });

  try {
    return Response.json(await renderTypstCached(source));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Typst render failed';
    return Response.json({ error: message }, { status: 500 });
  }
}
