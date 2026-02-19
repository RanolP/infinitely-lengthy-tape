import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@edhit/notebook': fileURLToPath(new URL('../../packages/notebook/src/index.ts', import.meta.url)),
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
