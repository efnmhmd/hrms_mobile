import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  server: {
    host: 'localhost',
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
