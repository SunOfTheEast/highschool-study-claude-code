import { defineConfig } from '@playwright/test';

const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 20_000,
  use: {
    baseURL: 'http://127.0.0.1:65001',
    browserName: 'chromium',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: [
    {
      command: 'bun run tests/e2e/fixture-server.ts',
      port: 65000,
      reuseExistingServer: false,
    },
    {
      command: 'bunx vite --host 127.0.0.1 --port 65001',
      port: 65001,
      reuseExistingServer: false,
    },
  ],
});
