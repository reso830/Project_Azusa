import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { mkdtemp, rm, writeFile, readFile, cp, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runMigrations } from '../../src/persistence/migrate';
import { getDbContext, closeDbContext } from '../../src/persistence/client';
it('runner upgrades without data loss and rejects invalid SQL', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-upgrade-'));
  const dbDir = path.join(root, 'db');
  const folder = path.join(root, 'migrations');
  await cp('src/persistence/migrations', folder, { recursive: true });
  const client = new PGlite(dbDir);
  const db = drizzle(client);
  try {
    await runMigrations({ db, dbDir, migrationsFolder: folder });
    await client.exec(
      "INSERT INTO app_metadata (id,key,value) VALUES ('test','test','{}')",
    );
    const journalPath = path.join(folder, 'meta', '_journal.json');
    const journal = JSON.parse(await readFile(journalPath, 'utf8'));
    journal.entries.push({
      idx: 2,
      version: '7',
      when: journal.entries.at(-1).when + 1,
      tag: '0002_test',
      breakpoints: true,
    });
    await writeFile(journalPath, JSON.stringify(journal));
    await writeFile(
      path.join(folder, '0002_test.sql'),
      'CREATE INDEX idx_test ON app_metadata (created_at);',
    );
    await runMigrations({ db, dbDir, migrationsFolder: folder });
    expect(
      (await client.query("SELECT key FROM app_metadata WHERE key='test'"))
        .rows,
    ).toHaveLength(1);
    journal.entries.push({
      idx: 3,
      version: '7',
      when: journal.entries.at(-1).when + 1,
      tag: '0003_invalid',
      breakpoints: true,
    });
    await writeFile(journalPath, JSON.stringify(journal));
    await writeFile(path.join(folder, '0003_invalid.sql'), 'INVALID SQL;');
    await expect(
      runMigrations({ db, dbDir, migrationsFolder: folder }),
    ).rejects.toThrow();
    expect(
      await access(path.join(dbDir, '.azusa-last-healthy.json')).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
  } finally {
    await client.close();
    await rm(root, { recursive: true, force: true });
  }
}, 90000);
it('backs up an existing cluster before pending migrations', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-guard-'));
  const dbDir = path.join(root, 'db');
  const folder = path.join(root, 'migrations');
  await cp('src/persistence/migrations', folder, { recursive: true });
  try {
    await getDbContext({
      dbDir,
      backupDir: path.join(root, 'backups'),
      migrationsFolder: folder,
    });
    await closeDbContext();
    const j = path.join(folder, 'meta', '_journal.json');
    const journal = JSON.parse(await readFile(j, 'utf8'));
    journal.entries.push({
      idx: 2,
      version: '7',
      when: journal.entries.at(-1).when + 1,
      tag: '0002_pending',
      breakpoints: true,
    });
    await writeFile(j, JSON.stringify(journal));
    await writeFile(
      path.join(folder, '0002_pending.sql'),
      'CREATE TABLE must_not_exist (id int);',
    );
    const reopened = await getDbContext({
      dbDir,
      backupDir: path.join(root, 'backups'),
      migrationsFolder: folder,
    });
    expect(reopened.startupBackup.trigger).toBe('startup');
    expect(
      (
        await reopened.client.query(
          "SELECT to_regclass('must_not_exist') AS name",
        )
      ).rows[0],
    ).toEqual({ name: 'must_not_exist' });
  } finally {
    await closeDbContext();
    await rm(root, { recursive: true, force: true });
  }
}, 90000);

it('fails closed for a promotion journal before initializing a fresh cluster', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-journal-'));
  const dbDir = path.join(root, 'db');
  try {
    await writeFile(path.join(root, '.azusa-promote-journal.json'), '{}');
    await expect(
      getDbContext({ dbDir, backupDir: path.join(root, 'backups') }),
    ).rejects.toMatchObject({
      stage: 'backup',
    });
    expect(
      await access(path.join(dbDir, 'PG_VERSION')).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
  } finally {
    await closeDbContext();
    await rm(root, { recursive: true, force: true });
  }
}, 60000);
it('reports an invalid initial migration as migration failure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-invalid-'));
  const dbDir = path.join(root, 'db');
  const folder = path.join(root, 'migrations');
  await cp('src/persistence/migrations', folder, { recursive: true });
  try {
    await writeFile(
      path.join(folder, '0000_foundation_init.sql'),
      'INVALID SQL;',
    );
    await expect(
      getDbContext({
        dbDir,
        backupDir: path.join(root, 'backups'),
        migrationsFolder: folder,
      }),
    ).rejects.toMatchObject({ stage: 'migration' });
    expect(
      await access(path.join(dbDir, '.azusa-last-healthy.json')).then(
        () => true,
        () => false,
      ),
    ).toBe(false);
  } finally {
    await closeDbContext();
    await rm(root, { recursive: true, force: true });
  }
}, 60000);

it('CLI initializes an unverified existing database', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-cli-'));
  const dbDir = path.join(root, 'db');
  const client = new PGlite(dbDir);
  try {
    await client.waitReady;
    await client.close();
    const run = promisify(execFile);
    const { stdout } = await run(
      process.execPath,
      [path.resolve('node_modules/tsx/dist/cli.mjs'), 'scripts/db/migrate.ts'],
      {
        env: {
          ...process.env,
          AZUSA_DB_DIR: dbDir,
          AZUSA_BACKUP_DIR: path.join(root, 'backups'),
        },
      },
    );
    expect(JSON.parse(stdout)).toMatchObject({ ok: true });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 90000);

it('CLI initializes a fresh database', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-cli-fresh-'));
  const dbDir = path.join(root, 'db');
  try {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [path.resolve('node_modules/tsx/dist/cli.mjs'), 'scripts/db/migrate.ts'],
      {
        env: {
          ...process.env,
          AZUSA_DB_DIR: dbDir,
          AZUSA_BACKUP_DIR: path.join(root, 'backups'),
        },
      },
    );
    expect(JSON.parse(stdout)).toMatchObject({ ok: true, dbDir });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 90000);
it('reports corrupted postgres control file as init failure', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-control-'));
  const dbDir = path.join(root, 'db');
  const client = new PGlite(dbDir);
  try {
    await client.waitReady;
    await client.close();
    await writeFile(path.join(dbDir, 'global', 'pg_control'), 'corrupt');
    await expect(
      getDbContext({ dbDir, backupDir: path.join(root, 'backups') }),
    ).rejects.toMatchObject({
      stage: 'init',
    });
  } finally {
    await closeDbContext();
    await rm(root, { recursive: true, force: true });
  }
}, 90000);

it('health reports applied migration count and journal tag', async () => {
  const root = await mkdtemp(
    path.join(os.tmpdir(), 'azusa-health-migrations-'),
  );
  const dbDir = path.join(root, 'db');
  const folder = path.join(root, 'migrations');
  await cp('src/persistence/migrations', folder, { recursive: true });
  try {
    const ctx = await getDbContext({
      dbDir,
      backupDir: path.join(root, 'backups'),
      migrationsFolder: folder,
    });
    const j = path.join(folder, 'meta', '_journal.json');
    const journal = JSON.parse(await readFile(j, 'utf8'));
    journal.entries.push({
      idx: journal.entries.length,
      version: '7',
      when: journal.entries.at(-1).when + 1,
      tag: '0002_test',
      breakpoints: true,
    });
    await writeFile(j, JSON.stringify(journal));
    await writeFile(
      path.join(folder, '0002_test.sql'),
      'CREATE INDEX idx_health ON app_metadata (created_at);',
    );
    await runMigrations({
      db: drizzle(ctx.client),
      dbDir,
      migrationsFolder: folder,
    });
    const { getFoundationHealth } =
      await import('../../src/application/health/health-service');
    expect(
      (await getFoundationHealth({ dbDir, migrationsFolder: folder }))
        .migrations,
    ).toMatchObject({ count: journal.entries.length, latestTag: '0002_test' });
  } finally {
    await closeDbContext();
    await rm(root, { recursive: true, force: true });
  }
}, 90000);

it('CLI reports lock contention with stop-server guidance', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-cli-lock-'));
  const dbDir = path.join(root, 'db');
  try {
    await getDbContext({ dbDir, backupDir: path.join(root, 'backups') });
    try {
      await promisify(execFile)(
        process.execPath,
        [
          path.resolve('node_modules/tsx/dist/cli.mjs'),
          'scripts/db/migrate.ts',
        ],
        {
          env: {
            ...process.env,
            AZUSA_DB_DIR: dbDir,
            AZUSA_BACKUP_DIR: path.join(root, 'backups'),
          },
        },
      );
      throw new Error('CLI unexpectedly succeeded');
    } catch (error) {
      const e = error as { code?: number; stderr?: string };
      expect(e.code).toBe(1);
      expect(JSON.parse(e.stderr ?? '{}')).toMatchObject({
        stage: 'init',
        message: expect.stringContaining('Stop the running Azusa server'),
      });
    }
  } finally {
    await closeDbContext();
    await rm(root, { recursive: true, force: true });
  }
}, 90000);
