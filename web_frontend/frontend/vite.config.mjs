import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['REACT_APP_', 'VITE_']);

  // Expose every REACT_APP_* / VITE_* var as process.env.<NAME> so legacy
  // source code keeps working without edits.
  const processEnvShim = Object.fromEntries(
    Object.entries(env).map(([k, v]) => [`process.env.${k}`, JSON.stringify(v)])
  );

  return {
    plugins: [
      react({
        include: /\.(js|jsx|ts|tsx)$/,
      }),
    ],

    // Treat .js files as JSX (the codebase puts JSX in .js files).
    esbuild: {
      loader: 'jsx',
      include: /src\/.*\.jsx?$/,
      exclude: [],
    },

    optimizeDeps: {
      esbuildOptions: {
        loader: { '.js': 'jsx' },
      },
    },

    resolve: {
      alias: {
        '@': path.resolve(process.cwd(), 'src'),
      },
    },

    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      ...processEnvShim,
    },

    server: {
      host: 'localhost',
      port: 3001,
      strictPort: false,
      proxy: {
        '/api': {
          target: 'http://localhost:5006',
          changeOrigin: true,
        },
        '/uploads': {
          target: 'http://localhost:5006',
          changeOrigin: true,
        },
      },
    },

    build: {
      outDir: 'build',
      sourcemap: false,
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('/maplibre-gl/') || id.includes('/leaflet/') ||
                id.includes('/protomaps-leaflet/') || id.includes('/pmtiles/') ||
                id.includes('/@mapbox/')) return 'maps';
            if (id.includes('/pdfjs-dist/')) return 'pdf';
            if (id.includes('/@mui/')) return 'mui';
            if (id.includes('/@emotion/')) return 'emotion';
            if (id.includes('/@radix-ui/')) return 'radix';
            if (id.includes('/framer-motion/')) return 'motion';
            if (id.includes('/react-router') || id.includes('/react-dom/') ||
                /\/react\//.test(id)) return 'react-vendor';
            if (id.includes('/date-fns') || id.includes('/dayjs/') ||
                id.includes('/moment-timezone/') || id.includes('/react-day-picker/')) return 'dates';
            if (id.includes('/slick-carousel/') || id.includes('/react-toastify/') ||
                id.includes('/lucide-react/') || id.includes('/@heroicons/')) return 'ui-misc';
            return 'vendor';
          },
        },
      },
    },

    preview: {
      port: 3001,
    },
  };
});
