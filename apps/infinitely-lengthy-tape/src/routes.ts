import { type RouteConfig, index, route } from '@react-router/dev/routes';

const isReadOnlyBuild = process.env.VITE_READ_ONLY === 'true';

export default [
  ...(!isReadOnlyBuild
    ? [
        route('api/tree', 'routes/api/tree.ts'),
        route('api/file', 'routes/api/file.ts'),
        route('api/mkdir', 'routes/api/mkdir.ts'),
        route('api/rename', 'routes/api/rename.ts'),
        route('api/typst/render', 'routes/api/typst-render.ts'),
      ]
    : []),
  index('routes/home.tsx'),
  route('*', 'routes/tape.tsx'),
] satisfies RouteConfig;
