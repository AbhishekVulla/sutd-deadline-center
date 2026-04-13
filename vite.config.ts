import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { build } from 'vite';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: 'manifest.json', dest: '.' },
        { src: 'public/icon16.jpg', dest: '.' },
        { src: 'public/icon48.jpg', dest: '.' },
        { src: 'public/icon128.jpg', dest: '.' }
      ]
    }),
    {
      name: 'build-content-script',
      apply: 'build',
      async closeBundle() {
        await build({
          configFile: false,
          build: {
            outDir: 'dist',
            emptyOutDir: false,
            lib: {
              entry: resolve(__dirname, 'src/content/content-unified.ts'),
              name: 'content',
              formats: ['iife'],
              fileName: () => 'content.js'
            },
            rollupOptions: {
              output: {
                extend: true
              }
            },
            minify: false,
            sourcemap: false
          },
          resolve: {
            alias: {
              '@': resolve(__dirname, './src')
            }
          }
        });
      }
    }
  ],
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        options: resolve(__dirname, 'options.html')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]'
      }
    },
    minify: false,
    sourcemap: false
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
});
