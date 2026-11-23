import { it, expect } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  recordDiagnosticCheck,
  getFoundationHealth,
} from '../../src/application/health/health-service';
import {
  closeDbContext,
  resetDbStateForTesting,
} from '../../src/persistence/client';
it('persists diagnostic data across close and reopen', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-restart-'));
  const options = {
    dbDir: path.join(root, 'db'),
    backupDir: path.join(root, 'backups'),
  };
  try {
    const first = await recordDiagnosticCheck({ note: 'first' }, options);
    if (!first.ok) throw Error(first.error);
    expect(first.ok).toBe(true);
    const saved = first.record!;
    expect(saved.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    await closeDbContext();
    const health = await getFoundationHealth(options);
    expect(health.latestDiagnostic).toMatchObject({
      id: saved.id,
      note: 'first',
      checkCount: 1,
      createdBy: 'local:sm',
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
    });
    const concurrent = await Promise.all(
      Array.from({ length: 8 }, () =>
        recordDiagnosticCheck({ note: 'parallel' }, options),
      ),
    );
    expect(concurrent.every((result) => result.ok)).toBe(true);
    expect(
      (await getFoundationHealth(options)).latestDiagnostic?.checkCount,
    ).toBe(9);
    const second = await recordDiagnosticCheck({ note: 'second' }, options);
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(Date.parse(second.record!.updatedAt)).toBeGreaterThan(
        Date.parse(saved.updatedAt),
      );
      expect(second.record).toMatchObject({
        id: saved.id,
        checkCount: 10,
        createdAt: saved.createdAt,
      });
    }
  } finally {
    await closeDbContext();
    await rm(root, { recursive: true, force: true });
  }
}, 90000);
it('reports a corrupt cluster before a promotion journal', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-corrupt-'));
  const dbDir = path.join(root, 'db');
  try {
    await mkdir(dbDir);
    await writeFile(path.join(dbDir, 'PG_VERSION'), 'invalid');
    await writeFile(path.join(root, '.azusa-promote-journal.json'), '{}');
    const h = await getFoundationHealth({
      dbDir,
      backupDir: path.join(root, 'backups'),
    });
    expect(h.errors[0]?.stage).toBe('init');
  } finally {
    await resetDbStateForTesting();
    await rm(root, { recursive: true, force: true });
  }
}, 60000);

it('reports malformed stored metadata as a query error', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-malformed-'));
  const options = {
    dbDir: path.join(root, 'db'),
    backupDir: path.join(root, 'backups'),
  };
  try {
    const { getDbContext } = await import('../../src/persistence/client');
    const ctx = await getDbContext(options);
    await ctx.client.exec(
      "INSERT INTO app_metadata (id,key,value) VALUES ('550e8400-e29b-41d4-a716-446655440000','diagnostic.last_check','{}')",
    );
    const health = await getFoundationHealth(options);
    expect(health.status).toBe('error');
    expect(health.errors[0]?.stage).toBe('query');
  } finally {
    await closeDbContext();
    await rm(root, { recursive: true, force: true });
  }
}, 60000);
it('rejects malformed request JSON without caching', async () => {
  const { POST } = await import('../../src/app/api/health/check/route');
  for (const body of ['{', JSON.stringify({ actor: 'forbidden' })]) {
    const response = await POST(
      new Request('http://localhost/api/health/check', {
        method: 'POST',
        body,
      }),
    );
    expect(response.status).toBe(400);
    expect(response.headers.get('cache-control')).toBe('no-store');
  }
});

it('reports unreadable version as query failure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-version-'));
  const options = {
    dbDir: path.join(root, 'db'),
    backupDir: path.join(root, 'backups'),
  };
  try {
    const { getDbContext } = await import('../../src/persistence/client');
    await getDbContext(options);
    await rm(path.join(options.dbDir, 'PG_VERSION'));
    const health = await getFoundationHealth(options);
    expect(health.status).toBe('error');
    expect(health.errors[0]?.stage).toBe('query');
  } finally {
    await closeDbContext();
    await rm(root, { recursive: true, force: true });
  }
}, 60000);
