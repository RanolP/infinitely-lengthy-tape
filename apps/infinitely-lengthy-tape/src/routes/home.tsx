import { App } from '../app/app-shell.js';
import { useLoaderData } from 'react-router';
import { loadTapeRouteData } from '../shared/loader/tape-data.server.js';

export async function loader() {
  return loadTapeRouteData(undefined);
}

export default function HomeRoute() {
  const loaderData = useLoaderData<typeof loader>();
  return <App initialData={loaderData} />;
}
