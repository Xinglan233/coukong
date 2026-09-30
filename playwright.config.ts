import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, timeout: 60_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions: { ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) } },
  webServer: [
    { command: 'npx tsx scripts/e2e-server.ts', url: 'http://127.0.0.1:8787/api/v1/ready', reuseExistingServer: false, timeout: 180_000, env: { TONGYE_E2E_ADMIN_ROOT: 'a'.repeat(64) } },
    { command: 'npx tsx scripts/generate-help.ts && npx vite --host 127.0.0.1 --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: false, env: { VITE_API_URL: 'http://localhost:8787' }, timeout: 180_000 },
  ],
})
