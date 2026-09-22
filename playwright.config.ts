import {defineConfig, devices} from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true, workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0, reporter: [['list'], ['html', {open: 'never'}]],
  use: {baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3100', locale: 'ko-KR', trace: 'retain-on-failure'},
  projects: [
    {name: 'desktop', use: {...devices['Desktop Chrome']}},
    {name: 'mobile', use: {...devices['Pixel 7']}}
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {command: 'node node_modules/next/dist/bin/next start --hostname localhost --port 3100', url: 'http://localhost:3100', reuseExistingServer: !process.env.CI, timeout: 120000}
});
