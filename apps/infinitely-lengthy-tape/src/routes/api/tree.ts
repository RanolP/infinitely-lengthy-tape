import { getTree } from '../../shared/server/tape-workspace.server.js';

export async function loader() {
  try {
    const tree = await getTree();
    return Response.json(tree);
  } catch {
    return Response.json({ error: 'Failed to scan directory' }, { status: 500 });
  }
}
