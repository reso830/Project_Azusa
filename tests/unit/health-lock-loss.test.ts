import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  cachedError: undefined as Error | undefined,
  select: vi.fn(),
  write: vi.fn(),
}));
vi.mock('../../src/persistence/client', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../src/persistence/client')>();
  return {
    ...actual,
    getCachedDbError: () => mocks.cachedError,
    getDbContext: async () => ({
      dbDir: '/test/db',
      backupDir: '/test/backups',
      migrationsFolder: '/test/migrations',
      startupBackup: { trigger: 'skipped_cold_start' },
      db: {
        select: () => ({ from: mocks.select }),
        insert: () => ({ values: () => ({ onConflictDoUpdate: mocks.write }) }),
      },
      client: { query: async () => ({ rows: [] }) },
    }),
  };
});
vi.mock('../../src/persistence/backup', () => ({
  getBackupSummary: async () => ({
    lastBackupId: null,
    lastBackupAt: null,
    lastBackupTrigger: null,
    backupCount: 0,
  }),
}));
vi.mock('node:fs/promises', () => ({
  readFile: async (file: string) =>
    file.endsWith('PG_VERSION') ? '18' : '{"entries":[]}',
}));
import { FoundationError } from '../../src/persistence/client';
import { GET } from '../../src/app/api/health/route';
import { POST } from '../../src/app/api/health/check/route';
beforeEach(() => {
  mocks.cachedError = undefined;
  mocks.select.mockReset().mockResolvedValue([]);
  mocks.write.mockReset().mockResolvedValue(undefined);
});
function lockLost() {
  mocks.cachedError = new FoundationError(
    'init',
    'Database lock lost',
    'Restart and verify exclusive access.',
  );
  throw new Error('PGlite is closed');
}
it('reports cached lock loss when an in-flight health query fails', async () => {
  mocks.select.mockImplementationOnce(async () => lockLost());
  const response = await GET(new Request('http://localhost/api/health'));
  expect(response.status).toBe(503);
  expect((await response.json()).errors).toEqual([
    {
      stage: 'init',
      message: 'Database lock lost',
      recoveryHint: 'Restart and verify exclusive access.',
    },
  ]);
});
it('reports cached lock loss when an in-flight diagnostic write fails', async () => {
  mocks.write.mockImplementationOnce(async () => lockLost());
  const response = await POST(
    new Request('http://localhost/api/health/check', {
      method: 'POST',
      body: '{}',
    }),
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({
    ok: false,
    stage: 'init',
    error: 'Database lock lost',
    recoveryHint: 'Restart and verify exclusive access.',
  });
});
it('returns failure when lock loss is discovered after a diagnostic write', async () => {
  mocks.write.mockImplementationOnce(async () => {
    mocks.cachedError = new FoundationError(
      'init',
      'Database lock lost',
      'Restart and verify exclusive access.',
    );
  });
  mocks.select.mockResolvedValueOnce([]).mockImplementationOnce(async () => {
    throw mocks.cachedError;
  });
  const response = await POST(
    new Request('http://localhost/api/health/check', {
      method: 'POST',
      body: '{}',
    }),
  );
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({ ok: false, stage: 'init' });
});
it('keeps ordinary query failures distinct from lock loss', async () => {
  mocks.write.mockRejectedValueOnce(new Error('ordinary query failure'));
  const response = await POST(
    new Request('http://localhost/api/health/check', {
      method: 'POST',
      body: '{}',
    }),
  );
  expect(response.status).toBe(500);
  expect(await response.json()).toMatchObject({
    ok: false,
    stage: 'query',
    error: 'ordinary query failure',
  });
});
