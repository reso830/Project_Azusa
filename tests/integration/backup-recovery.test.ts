import { it, expect } from 'vitest';
import {
  mkdtemp,
  rm,
  readFile,
  writeFile,
  readdir,
  mkdir,
  realpath,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { closeDbContext, getDbContext } from '../../src/persistence/client';

import { setupBackupFixture } from '../support/backup-fixture';
const fixture = setupBackupFixture();
const { seedDb, cloneImmutableBackup } = fixture;

it('recovers an interrupted promotion before startup', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-recovery-test-'));
  const dbDir = path.join(root, 'db'),
    backupDir = path.join(root, 'backups');
  const replaced = path.join(root, 'db-replaced-test');
  const staging = path.join(root, '.restore-tmp-test');
  try {
    const ctx = await getDbContext({ dbDir, backupDir });
    const before = await ctx.client.query('SELECT id FROM app_metadata');
    await closeDbContext();
    const { rename } = await import('node:fs/promises');
    await rename(dbDir, replaced);
    await mkdir(staging);
    await writeFile(
      path.join(root, '.azusa-promote-journal.json'),
      JSON.stringify({
        activeDbDir: process.platform === 'win32' ? dbDir.toLowerCase() : dbDir,
        replacedDir:
          process.platform === 'win32' ? replaced.toLowerCase() : replaced,
        stagingDir: path.basename(staging),
        startedAt: new Date().toISOString(),
      }),
    );
    const reopened = await getDbContext({ dbDir, backupDir });
    expect(
      (await reopened.client.query('SELECT id FROM app_metadata')).rows,
    ).toEqual(before.rows);
    expect((await readdir(root)).includes('.azusa-promote-journal.json')).toBe(
      false,
    );
    expect((await readdir(root)).includes('.restore-tmp-test')).toBe(false);
  } finally {
    await closeDbContext();
    await rm(root, { recursive: true, force: true });
  }
}, 180000);

it('does not evict earlier backups when startup migration fails repeatedly', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-no-eviction-'));
  const dbDir = path.join(root, 'db'),
    backupDir = path.join(root, 'backups'),
    folder = path.join(root, 'migrations');
  try {
    const { cp } = await import('node:fs/promises');
    await cp('src/persistence/migrations', folder, { recursive: true });
    await seedDb(dbDir);
    const backupId = 'backup-existing-original-startup';
    const backupPath = path.join(backupDir, backupId);
    await cp(fixture.backup.backupPath, backupPath, { recursive: true });
    const manifest = {
      ...fixture.backup.manifest,
      backupId,
      trigger: 'startup' as const,
    };
    await writeFile(
      path.join(backupPath, 'manifest.json'),
      JSON.stringify(manifest),
    );
    const original = { backupId, backupPath, manifest };
    const good: string[] = [original.backupId];
    for (let i = 0; i < 9; i++) {
      const backupId = `backup-existing-${i}-startup`;
      const dir = path.join(backupDir, backupId);
      await cloneImmutableBackup(original.backupPath, dir);
      await writeFile(
        path.join(dir, 'manifest.json'),
        JSON.stringify({
          ...original.manifest,
          backupId,
          createdAt: new Date(1700000000000 + i * 1000).toISOString(),
        }),
      );
      good.push(backupId);
    }
    const journalFile = path.join(folder, 'meta', '_journal.json');
    const journal = JSON.parse(await readFile(journalFile, 'utf8'));
    journal.entries.push({
      idx: 1,
      version: '7',
      when: journal.entries[0].when + 1,
      tag: '0001_invalid',
      breakpoints: true,
    });
    await writeFile(journalFile, JSON.stringify(journal));
    await writeFile(path.join(folder, '0001_invalid.sql'), 'INVALID SQL;');
    const { getFoundationHealth } =
      await import('../../src/application/health/health-service');
    for (let i = 0; i < 5; i++) {
      const health = await getFoundationHealth({
        dbDir,
        backupDir,
        migrationsFolder: folder,
      });
      expect(health.status).toBe('error');
      expect(health.errors[0]?.stage).toBe('migration');
    }
    for (let i = 0; i < 5; i++) {
      await closeDbContext();
      await expect(
        getDbContext({ dbDir, backupDir, migrationsFolder: folder }),
      ).rejects.toMatchObject({ stage: 'migration' });
    }
    const remaining = await readdir(backupDir);
    for (const id of good) expect(remaining).toContain(id);
    await closeDbContext();
    await writeFile(
      path.join(folder, '0001_invalid.sql'),
      'CREATE TABLE recovery_test (id integer);',
    );
    const recovered = await getDbContext({
      dbDir,
      backupDir,
      migrationsFolder: folder,
    });
    expect(recovered.startupBackup.trigger).toBe('skipped_unverified');
    const afterRecovery = await readdir(backupDir);
    for (const id of good) expect(afterRecovery).toContain(id);
  } finally {
    await closeDbContext();
    await rm(root, { recursive: true, force: true });
  }
}, 300000);

it('preserves the replaced database when a completed promotion is already healthy and recovers a partial active cluster', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-journal-test-'));
  const dbDir = path.join(root, 'db'),
    backupDir = path.join(root, 'backups');
  const replacedDir = path.join(root, 'db-replaced-test'),
    stagingDir = path.join(root, '.restore-tmp-test');
  const journal = path.join(root, '.azusa-promote-journal.json');
  try {
    await seedDb(dbDir);
    const { cp } = await import('node:fs/promises');
    await cp(dbDir, replacedDir, { recursive: true });
    const originalControl = await readFile(
      path.join(replacedDir, 'global', 'pg_control'),
    );
    const entry = JSON.stringify({
      activeDbDir: dbDir,
      replacedDir,
      stagingDir,
      startedAt: new Date().toISOString(),
    });
    await writeFile(journal, entry);
    await getDbContext({ dbDir, backupDir });
    await closeDbContext();
    expect(
      await readFile(path.join(replacedDir, 'global', 'pg_control')),
    ).toEqual(originalControl);
    expect((await readdir(root)).includes('.azusa-promote-journal.json')).toBe(
      false,
    );
    await writeFile(path.join(dbDir, 'PG_VERSION'), 'invalid');
    await mkdir(stagingDir);
    await writeFile(journal, entry);
    const recovered = await getDbContext({ dbDir, backupDir });
    expect(
      (await recovered.client.query('SELECT key FROM app_metadata')).rows,
    ).toContainEqual({ key: 'foundation.init' });
    expect((await readdir(root)).includes('.azusa-promote-journal.json')).toBe(
      false,
    );
    await closeDbContext();
    await writeFile(path.join(dbDir, 'global', 'pg_control'), 'corrupt');
    await writeFile(journal, entry);
    await expect(getDbContext({ dbDir, backupDir })).rejects.toMatchObject({
      stage: 'backup',
    });
    expect((await readdir(root)).includes('.azusa-promote-journal.json')).toBe(
      true,
    );
  } finally {
    await closeDbContext();
    await rm(root, { recursive: true, force: true });
  }
}, 300000);

it('backup and restore CLI commands return their documented summaries', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-cli-ok-'));
  const dbDir = path.join(root, 'MyDatabase'),
    backupDir = path.join(root, 'backups'),
    target = path.join(root, 'MyRestore');
  try {
    await seedDb(dbDir);
    const run = promisify(execFile);
    const env = {
      ...process.env,
      AZUSA_DB_DIR: dbDir,
      AZUSA_BACKUP_DIR: backupDir,
    };
    const cli = path.resolve('node_modules/tsx/dist/cli.mjs');
    const backupResult = await run(
      process.execPath,
      [cli, 'scripts/db/backup.ts'],
      { env },
    );
    const backup = JSON.parse(backupResult.stdout) as {
      ok: boolean;
      backupId: string;
      backupPath: string;
      filesCopied: number;
    };
    expect(backup).toMatchObject({
      ok: true,
      backupId: expect.stringMatching(/-manual$/),
      backupPath: expect.any(String),
      filesCopied: expect.any(Number),
    });
    const restored = await run(
      process.execPath,
      [cli, 'scripts/db/restore.ts', '--from', 'latest', '--to', target],
      { env },
    );
    expect(JSON.parse(restored.stdout)).toMatchObject({
      ok: true,
      backupId: backup.backupId,
      restoredTo: path.join(await realpath(root), 'MyRestore'),
      recordCount: 1,
      foundationRecordId: expect.any(String),
    });
    const { getFoundationHealth } =
      await import('../../src/application/health/health-service');
    const coldHealth = await getFoundationHealth({
      dbDir: path.join(root, 'fresh-db'),
      backupDir,
    });
    expect(coldHealth.backup).toMatchObject({
      lastBackupId: backup.backupId,
      lastBackupTrigger: 'manual',
      backupCount: 0,
    });
    await closeDbContext();
    const manifest = JSON.parse(
      await readFile(path.join(backup.backupPath, 'manifest.json'), 'utf8'),
    ) as {
      sourceDbDir: string;
      files: { relativePath: string; sha256: string }[];
    };
    expect(manifest.sourceDbDir).toBe(await realpath(dbDir));
    for (const file of manifest.files) {
      const bytes = await readFile(path.join(dbDir, file.relativePath));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(
        file.sha256,
      );
    }
  } finally {
    await closeDbContext();
    await rm(root, { recursive: true, force: true });
  }
}, 180000);
