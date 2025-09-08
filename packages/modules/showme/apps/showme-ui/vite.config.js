import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: __dirname,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html')
    }
  },
  server: {
    port: 3701,
    host: true,
    cors: true,
    proxy: {
      '/showme': {
        target: 'ws://localhost:3700',
        ws: true,
        changeOrigin: true
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@showme': path.resolve(__dirname, '../../src'),
      '@legion/components': path.resolve(__dirname, '../../../../components/src'),
      '@legion/actor-framework': path.resolve(__dirname, '../../../../actor-framework/src')
    }
  },
  optimizeDeps: {
    include: []
  }
});