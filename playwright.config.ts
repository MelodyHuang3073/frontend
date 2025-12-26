import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Run seeder before the test suite so emulator has expected users/data
  globalSetup: './e2e/global-setup.ts',
  testDir: './e2e/playwright',
  timeout: 60_000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'test-report' }]],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
