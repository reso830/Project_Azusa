import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://127.0.0.1:3100',
    timezoneId: 'Asia/Manila',
    locale: 'en-US',
  },
  projects: [
    {
      name: 'visual',
      testMatch: 'visual/**/*.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'e2e',
      testMatch: 'e2e/**/*.spec.ts',
      // The restore test fingerprints the database shared by these specs.
      workers: 1,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx tsx scripts/test/start-playwright-server.ts',
    url: 'http://127.0.0.1:3100',
    // Includes database seeding and cold Next.js startup on slower machines.
    timeout: 180000,
    reuseExistingServer: false,
    env: {
      PORT: '3100',
      AZUSA_NEXT_DIST_DIR: '.next-playwright',
      AZUSA_DB_DIR: '.azusa/test-playwright/db',
      AZUSA_BACKUP_DIR: '.azusa/test-playwright/backups',
      AZUSA_ALLOW_TEST_FAULT_INJECTION: '1',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
