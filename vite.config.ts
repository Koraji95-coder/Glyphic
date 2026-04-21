import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Split heavy / independently-cacheable libraries into their own
        // chunks so the main bundle stays under Vite's 500 kB warning limit
        // and so library upgrades don't bust the user-code cache.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/fabric/')) return 'fabric';
          if (id.includes('/@tiptap/') || id.includes('/prosemirror-')) return 'tiptap';
          if (id.includes('/lowlight/') || id.includes('/highlight.js/')) return 'lowlight';
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/react-router') ||
            id.includes('/scheduler/')
          ) {
            return 'react-vendor';
          }
          return undefined;
        },
      },
    },
  },
}));
