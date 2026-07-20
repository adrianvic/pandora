import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  base: '/pandora/',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
});
