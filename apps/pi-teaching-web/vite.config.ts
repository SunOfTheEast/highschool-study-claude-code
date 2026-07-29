import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiPort = Number(process.env.STUDYFORGE_E2E_API_PORT ?? 65000);
const clientPort = Number(process.env.STUDYFORGE_E2E_CLIENT_PORT ?? 65001);

export default defineConfig({
  plugins: [react()],
  server: {
    port: clientPort,
    proxy: {
      '/api': `http://127.0.0.1:${apiPort}`,
      '/events': { target: `ws://127.0.0.1:${apiPort}`, ws: true },
    },
  },
});
