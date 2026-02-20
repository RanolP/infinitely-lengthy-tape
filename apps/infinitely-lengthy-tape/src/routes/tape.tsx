import { useLoaderData } from 'react-router';
import { App } from '../app/app-shell.js';
import { loadTapeRouteData } from '../shared/loader/tape-data.server.js';

export async function loader({ params }: { params: Record<string, string | undefined> }) {
  return loadTapeRouteData(params['*']);
}

export default function TapeRoute() {
  const loaderData = useLoaderData<typeof loader>();
  return <App initialData={loaderData} />;
}
