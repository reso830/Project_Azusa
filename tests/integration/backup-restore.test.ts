import { it, expect, vi } from 'vitest';
import {
  mkdtemp,
  rm,
  readFile,
  writeFile,
  readdir,
  mkdir,
  utimes,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';

import os from 'node:os';
import path from 'node:path';
import { closeDbContext, getDbContext } from '../../src/persistence/client';
import {
  createManualBackup,
  createStartupSnapshotIfNeeded,
  getBackupSummary,
  pruneCompletedStartupBackups,
  restoreBackup,
} from '../../src/persistence/backup';

import { setupBackupFixture } from '../support/backup-fixture';
const fixture = setupBackupFixture();
const { seedDb, seedBackup } = fixture;

it('creates a snapshot and restores a diagnostic record to a disjoint directory', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-backup-test-'));
  const dbDir = path.join(root, 'db');
  const backupDir = path.join(root, 'backups');
  try {
    const { recordDiagnosticCheck } =
      await import('../../src/application/health/health-service');
    const first = await recordDiagnosticCheck(
      { note: 'recover me' },
      { dbDir, backupDir },
    );
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.error);
    const saved = first.record;
    await closeDbContext();
    const backup = await createManualBackup({ dbDir, backupDir });
    const manifestBefore = await readFile(
      path.join(backup.backupPath, 'manifest.json'),
      'utf8',
    );
    await expect(
      restoreBackup({
        from: backup.backupId,
        to: dbDir,
        activeDbDir: dbDir,
        backupDir,
      }),
    ).rejects.toThrow('force');
    const manifest = JSON.parse(manifestBefore) as {
      files: { relativePath: string; sha256: string }[];
    };
    for (const file of manifest.files) {
      const contents = await readFile(path.join(dbDir, file.relativePath));
      expect(createHash('sha256').update(contents).digest('hex')).toBe(
        file.sha256,
      );
    }
    await mkdir(path.join(backupDir, '.tmp-stale'));
    await utimes(path.join(backupDir, '.tmp-stale'), new Date(0), new Date(0));
    await getDbContext({ dbDir, backupDir });
    expect((await readdir(backupDir)).includes('.tmp-stale')).toBe(false);
    const restored = path.join(root, 'restored');
    const attempts = await Promise.allSettled(
      Array.from({ length: 2 }, () =>
        restoreBackup({
          from: backup.backupId,
          to: restored,
          activeDbDir: dbDir,
          backupDir,
        }),
      ),
    );
    const success = attempts.find((result) => result.status === 'fulfilled');
    expect(
      attempts.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      attempts.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(success?.status === 'fulfilled' && success.value.recordCount).toBe(
      2,
    );
    await closeDbContext();
    await expect(
      restoreBackup({
        from: backup.backupId,
        to: path.join(backupDir, 'unsafe'),
        activeDbDir: dbDir,
        backupDir,
        forceOverwriteActive: true,
      }),
    ).rejects.toThrow('overlaps');
    await expect(
      restoreBackup({
        from: backup.backupId,
        to: path.join(dbDir, 'nested'),
        activeDbDir: dbDir,
        backupDir,
        forceOverwriteActive: true,
      }),
    ).rejects.toThrow('overlaps');
    if (process.platform === 'win32') {
      await expect(
        restoreBackup({
          from: backup.backupId,
          to: dbDir.toUpperCase(),
          activeDbDir: dbDir,
          backupDir,
        }),
      ).rejects.toThrow('force');
    }
    await expect(
      restoreBackup({
        from: backup.backupId,
        to: restored,
        activeDbDir: dbDir,
        backupDir,
      }),
    ).rejects.toThrow('not empty');
    await writeFile(path.join(backup.backupPath, 'PG_VERSION'), 'corrupt');
    await expect(
      restoreBackup({
        from: backup.backupId,
        to: path.join(root, 'corrupt-target'),
        activeDbDir: dbDir,
        backupDir,
      }),
    ).rejects.toThrow('integrity');
    await writeFile(path.join(backup.backupPath, 'PG_VERSION'), '18\n');
    expect(
      await readFile(path.join(backup.backupPath, 'manifest.json'), 'utf8'),
    ).toBe(manifestBefore);
    const ctx = await getDbContext({
      dbDir: restored,
      backupDir: path.join(root, 'restored-backups'),
    });
    const row = await ctx.client.query<{ value: { note: string } }>(
      "SELECT value FROM app_metadata WHERE key = 'diagnostic.last_check'",
    );
    expect(row.rows[0]?.value.note).toBe('recover me');
    const { getFoundationHealth } =
      await import('../../src/application/health/health-service');
    expect(
      (
        await getFoundationHealth({
          dbDir: restored,
          backupDir: path.join(root, 'restored-backups'),
        })
      ).latestDiagnostic,
    ).toEqual(saved);
  } finally {
    await closeDbContext();
    await rm(root, { recursive: true, force: true });
  }
}, 300000);

it('rolls back a failed active promotion', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-promotion-test-'));
  const dbDir = path.join(root, 'db'),
    backupDir = path.join(root, 'backups');
  try {
    await seedDb(dbDir);
    const backup = await seedBackup(backupDir);
    const version = await readFile(path.join(dbDir, 'PG_VERSION'));
    await expect(
      restoreBackup({
        from: backup.backupId,
        to: dbDir,
        activeDbDir: dbDir,
        backupDir,
        forceOverwriteActive: true,
        faultInjectStep: 'after-move-old',
      }),
    ).rejects.toThrow('Injected');
    expect(await readFile(path.join(dbDir, 'PG_VERSION'))).toEqual(version);
    expect(
      (await readdir(root)).some(
        (name) => name === '.azusa-promote-journal.json',
      ),
    ).toBe(false);
    const promoted = await restoreBackup({
      from: backup.backupId,
      to: dbDir,
      activeDbDir: dbDir,
      backupDir,
      forceOverwriteActive: true,
    });
    expect(promoted.replacedDbPreserved).toBeTruthy();
    expect(
      await readFile(path.join(promoted.replacedDbPreserved!, 'PG_VERSION')),
    ).toEqual(version);
    expect((await readdir(root)).includes('.azusa-promote-journal.json')).toBe(
      false,
    );
  } finally {
    await closeDbContext();
    await rm(root, { recursive: true, force: true });
  }
}, 300000);

it('fails startup at backup stage if the backup path is a file', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-backup-fail-'));
  const dbDir = path.join(root, 'db'),
    backupDir = path.join(root, 'backups');
  try {
    const cold = await getDbContext({ dbDir, backupDir });
    expect(cold.startupBackup.trigger).toBe('skipped_cold_start');
    await closeDbContext();
    await writeFile(backupDir, 'not a directory');
    await expect(getDbContext({ dbDir, backupDir })).rejects.toMatchObject({
      stage: 'backup',
    });
  } finally {
    await closeDbContext();
    await rm(root, { recursive: true, force: true });
  }
}, 60000);

it('prunes only old startup backups and retains manual backups', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-retention-'));
  try {
    for (let i = 0; i < 14; i++) {
      const trigger = i < 12 ? 'startup' : 'manual';
      const backupId = `backup-${String(i).padStart(2, '0')}-${trigger}`;
      const dir = path.join(root, backupId);
      await mkdir(dir);
      await writeFile(path.join(dir, 'PG_VERSION'), '18');
      await writeFile(
        path.join(dir, 'manifest.json'),
        JSON.stringify({
          backupId,
          trigger,
          createdAt: new Date(1700000000000 + i * 1000).toISOString(),
          sourceDbDir: 'db',
          fileCount: 1,
          totalBytes: 2,
          actor: 'local:sm',
          pgVersion: '18',
          files: [
            {
              relativePath: 'PG_VERSION',
              sizeBytes: 2,
              sha256: createHash('sha256').update('18').digest('hex'),
            },
          ],
        }),
      );
    }
    await mkdir(path.join(root, '.tmp-old'));
    await utimes(path.join(root, '.tmp-old'), new Date(0), new Date(0));
    const summary = await getBackupSummary(root);
    expect(summary).toMatchObject({
      backupCount: 12,
      lastBackupTrigger: 'manual',
      lastBackupId: 'backup-13-manual',
    });
    await pruneCompletedStartupBackups(root);
    const names = await readdir(root);
    expect(names.filter((name) => name.endsWith('-startup'))).toHaveLength(10);
    expect(names.filter((name) => name.endsWith('-manual'))).toHaveLength(2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('assigns a suffix to startup snapshots created in the same millisecond', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-snapshot-tie-'));
  const dbDir = path.join(root, 'db'),
    backupDir = path.join(root, 'backups');
  try {
    await seedDb(dbDir);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-20T10:30:00.000Z'));
    await mkdir(path.join(backupDir, 'backup-20261120-103000-000-startup'), {
      recursive: true,
    });
    const second = await createStartupSnapshotIfNeeded({ dbDir, backupDir });
    expect(second).toMatchObject({
      trigger: 'startup',
      backupId: 'backup-20261120-103000-000-01-startup',
    });
  } finally {
    vi.useRealTimers();
    await closeDbContext();
    await rm(root, { recursive: true, force: true });
  }
}, 180000);
