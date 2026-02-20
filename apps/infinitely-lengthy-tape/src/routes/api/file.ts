import type { TapeFile } from '../../shared/api/tape-api.js';
import { getFile, postFile, putFile, removeFile } from '../../shared/server/tape-workspace.server.js';

export async function loader({ request }: { request: Request }) {
  const url = new URL(request.url);
  const filePath = url.searchParams.get('path');
  if (!filePath) return Response.json({ error: 'Missing path' }, { status: 400 });

  const file = await getFile(filePath);
  if (!file) return Response.json({ error: 'File not found' }, { status: 404 });
  return Response.json(file);
}

export async function action({ request }: { request: Request }) {
  if (request.method === 'PUT') {
    const url = new URL(request.url);
    const filePath = url.searchParams.get('path');
    if (!filePath) return Response.json({ error: 'Missing path' }, { status: 400 });
    const body = (await request.json()) as TapeFile;
    const ok = await putFile(filePath, body);
    if (!ok) return Response.json({ error: 'Invalid path' }, { status: 400 });
    return Response.json({ ok: true });
  }

  if (request.method === 'POST') {
    const body = (await request.json()) as { path?: string };
    if (!body.path) return Response.json({ error: 'Missing path' }, { status: 400 });
    const ok = await postFile(body.path);
    if (!ok) return Response.json({ error: 'Invalid path' }, { status: 400 });
    return Response.json({ ok: true });
  }

  if (request.method === 'DELETE') {
    const url = new URL(request.url);
    const filePath = url.searchParams.get('path');
    if (!filePath) return Response.json({ error: 'Missing path' }, { status: 400 });
    const ok = await removeFile(filePath);
    if (!ok) return Response.json({ error: 'File not found' }, { status: 404 });
    return Response.json({ ok: true });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
