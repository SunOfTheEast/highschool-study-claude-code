import { defineConfig } from '@playwright/test';

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const apiPort = Number(process.env.STUDYFORGE_E2E_API_PORT ?? 65000);
const clientPort = Number(process.env.STUDYFORGE_E2E_CLIENT_PORT ?? 65001);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 20_000,
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${clientPort}`,
    browserName: 'chromium',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: [
    {
      command: 'bun run tests/e2e/fixture-server.ts',
      port: apiPort,
      reuseExistingServer: false,
    },
    {
      command: `bunx vite --host 127.0.0.1 --port ${clientPort}`,
      port: clientPort,
      reuseExistingServer: false,
    },
  ],
});
