import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 65001,
    proxy: {
      '/api': 'http://127.0.0.1:65000',
      '/events': { target: 'ws://127.0.0.1:65000', ws: true },
    },
  },
});
