import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

const testRoot = path.join(os.tmpdir(), `azusa-vitest-${randomUUID()}`);

export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'node',
    maxWorkers: 3,
    env: {
      AZUSA_DB_DIR: path.join(testRoot, 'db'),
      AZUSA_BACKUP_DIR: path.join(testRoot, 'backups'),
    },
    passWithNoTests: true,
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
  },
});
