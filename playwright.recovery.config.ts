import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', testMatch: 'password-recovery.spec.ts', workers: 1,
  outputDir: '/tmp/washops-recovery-browser-artifacts', reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4191', channel: 'chrome', trace: 'off', video: 'off', screenshot: 'only-on-failure' },
  webServer: { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4191', url: 'http://127.0.0.1:4191', reuseExistingServer: false }
});
