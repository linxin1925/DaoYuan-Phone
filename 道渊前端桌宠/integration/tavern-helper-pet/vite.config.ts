import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ command }) => ({
  plugins: [vue()],
  resolve: {
    alias: { '@': resolve(projectRoot, 'src') },
  },
  server: {
    host: '127.0.0.1',
    port: 5178,
    strictPort: true,
  },
  build:
    command === 'build'
      ? {
          lib: {
            entry: resolve(projectRoot, 'src/index.ts'),
            name: 'DaoyuanFeatureFrontend',
            formats: ['iife'],
            fileName: () => '道渊功能前端.js',
          },
          rollupOptions: { output: { inlineDynamicImports: true } },
          minify: 'esbuild',
          outDir: resolve(projectRoot, 'dist'),
          emptyOutDir: true,
        }
      : undefined,
}));
