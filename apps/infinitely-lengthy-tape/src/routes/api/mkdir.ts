import { makeDirectory } from '../../shared/server/tape-workspace.server.js';

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = (await request.json()) as { path?: string };
  if (!body.path) return Response.json({ error: 'Missing path' }, { status: 400 });

  const ok = await makeDirectory(body.path);
  if (!ok) return Response.json({ error: 'Invalid path' }, { status: 400 });
  return Response.json({ ok: true });
}
