import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [reactRouter(), tailwindcss()],
  resolve: {
    alias: {
      '@edhit/notebook': fileURLToPath(new URL('../../packages/notebook/src/index.ts', import.meta.url)),
      '@edhit/editor-core': fileURLToPath(new URL('../../packages/editor-core/src/index.ts', import.meta.url)),
      '@edhit/language': fileURLToPath(new URL('../../packages/language/src/index.ts', import.meta.url)),
      '@edhit/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@edhit/syntax': fileURLToPath(new URL('../../packages/syntax/src/index.ts', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: [
      '@myriaddreamin/typst.ts',
      '@myriaddreamin/typst.ts/contrib/snippet',
      '@myriaddreamin/typst-ts-renderer',
      '@myriaddreamin/typst-ts-web-compiler',
    ],
  },
  server: {
    watch: {
      ignored: ['**/workspace/**'],
    },
  },
});
