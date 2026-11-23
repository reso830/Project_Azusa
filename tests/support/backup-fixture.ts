import { beforeAll, afterAll } from 'vitest';
import {
  mkdtemp,
  rm,
  cp,
  mkdir,
  readdir,
  link,
  copyFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { runMigrations } from '../../src/persistence/migrate';
import { createManualBackup } from '../../src/persistence/backup';

export function setupBackupFixture() {
  let fixtureRoot: string;
  let fixtureDb: string;
  let fixtureBackup: Awaited<ReturnType<typeof createManualBackup>>;
  beforeAll(async () => {
    fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'azusa-fixture-'));
    fixtureDb = path.join(fixtureRoot, 'db');
    const client = new PGlite(fixtureDb);
    try {
      await client.waitReady;
      await runMigrations({ db: drizzle(client), dbDir: fixtureDb });
    } finally {
      await client.close();
    }
    fixtureBackup = await createManualBackup({
      dbDir: fixtureDb,
      backupDir: path.join(fixtureRoot, 'backups'),
    });
  }, 60000);
  afterAll(async () => {
    if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true });
  }, 60000);
  // Retention fixtures are immutable, so hard links preserve full snapshots without copying their data repeatedly.
  async function cloneImmutableBackup(source: string, target: string) {
    await mkdir(target, { recursive: true });
    for (const entry of await readdir(source, { withFileTypes: true })) {
      const from = path.join(source, entry.name),
        to = path.join(target, entry.name);
      if (entry.isDirectory()) await cloneImmutableBackup(from, to);
      else if (entry.name === 'manifest.json') await copyFile(from, to);
      else await link(from, to).catch(() => copyFile(from, to));
    }
  }
  async function seedDb(dbDir: string) {
    await cp(fixtureDb, dbDir, { recursive: true });
  }
  async function seedBackup(backupDir: string) {
    const backupPath = path.join(backupDir, fixtureBackup.backupId);
    await cp(fixtureBackup.backupPath, backupPath, { recursive: true });
    return { ...fixtureBackup, backupPath };
  }

  return {
    seedDb,
    seedBackup,
    cloneImmutableBackup,
    get backup() {
      return fixtureBackup;
    },
  };
}
