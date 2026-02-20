import { renamePath } from '../../shared/server/tape-workspace.server.js';

export async function action({ request }: { request: Request }) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const body = (await request.json()) as { from?: string; to?: string };
  if (!body.from || !body.to) {
    return Response.json({ error: 'Missing from/to' }, { status: 400 });
  }

  const ok = await renamePath(body.from, body.to);
  if (!ok) return Response.json({ error: 'Invalid path' }, { status: 400 });
  return Response.json({ ok: true });
}
