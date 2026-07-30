import { defineConfig } from '@playwright/test';

const artifacts = 'D:/Website-CRM-Audit/phase-0/playwright';

export default defineConfig({
  testDir: './tests/e2e',
  outputDir: `${artifacts}/artifacts`,
  reporter: [['list'], ['html', { outputFolder: `${artifacts}/html`, open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4179',
    channel: 'chrome',
    screenshot: 'only-on-failure',
    trace: 'on',
    video: 'on'
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4179',
    url: 'http://127.0.0.1:4179',
    reuseExistingServer: false,
    env: {
      VITE_ENABLE_BROWSER_FIXTURES: 'true',
      VITE_BROWSER_FIXTURE_ZERO_WEBSITE: 'true',
      VITE_BUILDER_PUBLICATION_PERSISTENCE: 'local',
      VITE_BUILDER_MEDIA_PERSISTENCE: 'local'
    }
  }
});
