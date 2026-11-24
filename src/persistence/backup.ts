import {
  access,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { z } from 'zod';
import { acquireDbLock, canonicalDbPath as canonical } from './lock';
import { renameDirectory } from './rename-directory';
import {
  AppMetadataEntrySchema,
  BackupManifestSchema,
} from '../domain/health/schemas';
import { resolveActor } from '../domain/audit/actor';
import { APP_VERSION } from './version';

const exists = async (p: string) =>
  access(p).then(
    () => true,
    () => false,
  );
type Manifest = z.infer<typeof BackupManifestSchema>;
type BackupOptions = { dbDir: string; backupDir: string; actor?: string };
// Allows integration tests to interrupt a real CLI at a reproducible operation boundary.
async function testCheckpoint(step: string) {
  if (
    process.env.NODE_ENV !== 'test' ||
    process.env.AZUSA_ALLOW_TEST_FAULT_INJECTION !== '1' ||
    process.env.AZUSA_TEST_LOCK_STEP !== step
  )
    return;
  process.stderr.write(`AZUSA_TEST_CHECKPOINT:${step}\n`);
  await new Promise((resolve) => setTimeout(resolve, 3500));
}

async function fileList(
  root: string,
  relative = '',
  check: () => void = () => {},
): Promise<Manifest['files']> {
  const result: Manifest['files'] = [];
  for (const entry of await readdir(path.join(root, relative), {
    withFileTypes: true,
  })) {
    check();
    const name = path.join(relative, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(
        `Symbolic links are not allowed in database snapshots: ${name}`,
      );
    if (entry.isDirectory())
      result.push(...(await fileList(root, name, check)));
    else if (entry.isFile()) {
      const bytes = await readFile(path.join(root, name));
      result.push({
        relativePath: name.split(path.sep).join('/'),
        sizeBytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    } else throw new Error(`Unsupported database entry: ${name}`);
  }
  return result.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}
async function completed(
  backupDir: string,
): Promise<{ id: string; manifest: Manifest }[]> {
  if (!(await exists(backupDir))) return [];
  const result: { id: string; manifest: Manifest }[] = [];
  for (const e of await readdir(backupDir, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith('.tmp-')) continue;
    try {
      const root = path.join(backupDir, e.name);
      const manifest = BackupManifestSchema.parse(
        JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8')),
      );
      if (
        manifest.backupId === e.name &&
        (await exists(path.join(root, 'PG_VERSION')))
      )
        result.push({ id: e.name, manifest });
    } catch {
      /* Ignore incomplete or invalid snapshots. */
    }
  }
  return result.sort(
    (a, b) =>
      b.manifest.createdAt.localeCompare(a.manifest.createdAt) ||
      b.id.localeCompare(a.id),
  );
}
function stamp(date = new Date()) {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .replace('.', '-')
    .replace('Z', '');
}
async function snapshot(
  { dbDir, backupDir, actor }: BackupOptions,
  trigger: 'startup' | 'manual',
  check: () => void = () => {},
) {
  const db = await canonical(dbDir),
    root = await canonical(backupDir);
  check();
  if (overlaps(db, root))
    throw new Error('Backup directory must not overlap database directory');
  if (!(await exists(path.join(db, 'PG_VERSION'))))
    throw new Error('No initialized database to back up');
  const pgVersion = (
    await readFile(path.join(db, 'PG_VERSION'), 'utf8')
  ).trim();
  if (!/^\d+$/.test(pgVersion)) throw new Error('Invalid PG_VERSION');
  check();
  await mkdir(root, { recursive: true });
  check();
  for (const entry of await readdir(root, { withFileTypes: true }))
    if (entry.isDirectory() && entry.name.startsWith('.tmp-')) {
      check();
      const candidate = path.join(root, entry.name);
      if (Date.now() - (await stat(candidate)).mtimeMs > 60 * 60 * 1000) {
        check();
        await rm(candidate, { recursive: true, force: true });
      }
    }
  check();
  const time = new Date();
  const prefix = `backup-${stamp(time)}`;
  let id = `${prefix}-${trigger}`;
  let n = 0;
  while (
    (await exists(path.join(root, id))) ||
    (await exists(path.join(root, `.tmp-${id}`)))
  )
    id = `${prefix}-${String(++n).padStart(2, '0')}-${trigger}`;
  const temp = path.join(root, `.tmp-${id}`);
  const dest = path.join(root, id);
  try {
    check();
    const original = await fileList(db, '', check);
    check();
    let paused = false;
    await cp(db, temp, {
      recursive: true,
      errorOnExist: true,
      force: false,
      filter: async (source) => {
        check();
        if (!paused && path.resolve(source) !== db) {
          paused = true;
          await testCheckpoint('backup-copy');
          check();
        }
        return true;
      },
    });
    check();
    const copied = await fileList(temp, '', check);
    if (JSON.stringify(original) !== JSON.stringify(copied))
      throw new Error('Snapshot verification failed');
    const manifest = BackupManifestSchema.parse({
      backupId: id,
      trigger,
      createdAt: time.toISOString(),
      sourceDbDir: db,
      fileCount: copied.length,
      totalBytes: copied.reduce((n, f) => n + f.sizeBytes, 0),
      actor: resolveActor(actor),
      pgVersion,
      files: copied,
    });
    await writeFile(
      path.join(temp, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
    );
    check();
    await renameDirectory(temp, dest, check);
    check();
    return {
      ok: true as const,
      backupId: id,
      backupPath: dest,
      filesCopied: copied.length,
      createdAt: manifest.createdAt,
      manifest,
    };
  } catch (e) {
    await rm(temp, { recursive: true, force: true });
    throw e;
  }
}
export async function createStartupSnapshotIfNeeded(
  options: BackupOptions,
  check?: () => void,
) {
  if (!(await exists(path.join(options.dbDir, 'PG_VERSION'))))
    return { trigger: 'skipped_cold_start' as const };
  if (!(await exists(path.join(options.dbDir, '.azusa-last-healthy.json'))))
    return { trigger: 'skipped_unverified' as const };
  const result = await snapshot(options, 'startup', check);
  return { trigger: 'startup' as const, ...result };
}
export async function pruneCompletedStartupBackups(
  backupDir: string,
  limit = 10,
  check: () => void = () => {},
) {
  const entries = (await completed(backupDir)).filter(
    (x) => x.manifest.trigger === 'startup',
  );
  for (const e of entries.slice(limit)) {
    check();
    await rm(path.join(backupDir, e.id), { recursive: true, force: true });
  }
}
export async function createManualBackup(options: BackupOptions) {
  let compromised: Error | undefined;
  const release = await acquireDbLock(options.dbDir, 'cli:backup', {
    onCompromised: (e) => {
      compromised = e;
    },
  });
  const check = () => {
    if (compromised) throw compromised;
  };
  try {
    return await snapshot(options, 'manual', check);
  } finally {
    await release().catch(() => {});
  }
}
function pathKey(value: string) {
  return process.platform === 'win32' ? value.toLowerCase() : value;
}
function overlaps(a: string, b: string) {
  a = pathKey(a);
  b = pathKey(b);
  const rel = path.relative(a, b);
  return (
    rel === '' ||
    (!rel.startsWith('..' + path.sep) &&
      rel !== '..' &&
      !path.isAbsolute(rel)) ||
    (() => {
      const reverse = path.relative(b, a);
      return (
        reverse === '' ||
        (!reverse.startsWith('..' + path.sep) &&
          reverse !== '..' &&
          !path.isAbsolute(reverse))
      );
    })()
  );
}
async function validateCluster(
  dir: string,
  onClient?: (client: PGlite | undefined) => void,
  check: () => void = () => {},
) {
  const client = new PGlite(dir);
  try {
    await client.waitReady;
    onClient?.(client);
    check();
    if (onClient) await testCheckpoint('restore-validation');
    check();
    const rows = await client.query<{
      id: string;
      key: string;
      value: unknown;
      created_at: Date | string;
      updated_at: Date | string;
      created_by: string;
      updated_by: string;
    }>('SELECT * FROM app_metadata');
    if (!rows.rows.some((x) => x.key === 'foundation.init'))
      throw new Error('Missing foundation.init');
    for (const row of rows.rows) {
      z.uuidv4().parse(row.id);
      AppMetadataEntrySchema.parse({ key: row.key, value: row.value });
      z.string().min(1).parse(row.created_by);
      z.string().min(1).parse(row.updated_by);
      if (
        Number.isNaN(new Date(row.created_at).getTime()) ||
        Number.isNaN(new Date(row.updated_at).getTime())
      )
        throw new Error('Invalid audit timestamp');
    }
    return {
      recordCount: rows.rows.length,
      foundationRecordId: rows.rows.find((x) => x.key === 'foundation.init')!
        .id,
    };
  } finally {
    onClient?.(undefined);
    await client.close().catch(() => {});
  }
}
type PromotionJournal = {
  activeDbDir: string;
  replacedDir: string;
  stagingDir: string;
  startedAt: string;
};
export async function recoverInterruptedPromotionIfNeeded(
  dbDir: string,
  check: () => void = () => {},
) {
  const active = await canonical(dbDir),
    parent = path.dirname(active),
    file = path.join(parent, '.azusa-promote-journal.json');
  if (!(await exists(file))) return;
  const j = JSON.parse(await readFile(file, 'utf8')) as PromotionJournal;
  const replaced = await canonical(j.replacedDir),
    stage = await canonical(
      path.isAbsolute(j.stagingDir)
        ? j.stagingDir
        : path.join(parent, j.stagingDir),
    );
  if (
    pathKey(await canonical(j.activeDbDir)) !== pathKey(active) ||
    pathKey(path.dirname(replaced)) !== pathKey(parent) ||
    !path.basename(replaced).startsWith('db-replaced-') ||
    pathKey(path.dirname(stage)) !== pathKey(parent) ||
    !path.basename(stage).startsWith('.restore-tmp-')
  )
    throw new Error('Invalid promotion journal');
  if (await exists(path.join(replaced, 'PG_VERSION'))) {
    let healthy = false;
    if (await exists(path.join(active, 'PG_VERSION'))) {
      try {
        await validateCluster(active);
        healthy = true;
      } catch {}
    }
    if (!healthy) {
      await validateCluster(replaced);
      check();
      await rm(stage, { recursive: true, force: true });
      check();
      await rm(active, { recursive: true, force: true });
      check();
      await renameDirectory(replaced, active, check);
    }
  } else {
    if (!(await exists(path.join(active, 'PG_VERSION'))))
      throw new Error('Promotion recovery cannot find a database');
    await validateCluster(active);
  }
  check();
  await rm(file, { force: true });
}
export async function restoreBackup(options: {
  from: string;
  to?: string;
  activeDbDir: string;
  backupDir: string;
  forceOverwriteActive?: boolean;
  faultInjectStep?: 'after-move-old';
}) {
  const active = await canonical(options.activeDbDir),
    backup = await canonical(options.backupDir);
  const choices = await completed(backup);
  const sourceInput =
    options.from === 'latest'
      ? choices[0]
        ? path.join(backup, choices[0].id)
        : ''
      : options.from.includes('/') ||
          options.from.includes('\\') ||
          path.isAbsolute(options.from)
        ? options.from
        : path.join(backup, options.from);
  if (!sourceInput) throw new Error('No completed backup available');
  const source = await canonical(sourceInput);
  const target = await canonical(
    options.to ?? path.join(path.dirname(active), `restored-${stamp()}`),
  );
  const isActive = pathKey(target) === pathKey(active);
  if (
    overlaps(target, source) ||
    overlaps(target, backup) ||
    (!isActive && overlaps(target, active))
  )
    throw new Error('Restore path overlaps protected directory');
  if (isActive && !options.forceOverwriteActive)
    throw new Error('Active database requires --force-overwrite-active');
  if (!isActive && (await exists(target)) && (await readdir(target)).length)
    throw new Error('Restore target is not empty');
  let compromised: Error | undefined;
  let validatingClient: PGlite | undefined;
  const release = await acquireDbLock(target, 'cli:restore', {
    onCompromised: (e) => {
      compromised = e;
      void validatingClient?.close().catch(() => {});
    },
  });
  const check = () => {
    if (compromised) throw compromised;
  };
  const temp = path.join(path.dirname(target), `.restore-tmp-${randomUUID()}`);
  let movedOld: string | undefined;
  const journal = path.join(
    path.dirname(target),
    '.azusa-promote-journal.json',
  );
  try {
    check();
    if (!isActive && (await exists(target)) && (await readdir(target)).length)
      throw new Error('Restore target is not empty');
    const manifest = BackupManifestSchema.parse(
      JSON.parse(await readFile(path.join(source, 'manifest.json'), 'utf8')),
    );
    if (!(await exists(path.join(source, 'PG_VERSION'))))
      throw new Error('Backup has no PG_VERSION');
    const version = (
      await readFile(path.join(source, 'PG_VERSION'), 'utf8')
    ).trim();
    if (!/^\d+$/.test(version) || version !== manifest.pgVersion)
      throw new Error('Backup file integrity check failed: PG_VERSION');
    check();
    const actual = (await fileList(source, '', check)).filter(
      (f) => f.relativePath !== 'manifest.json',
    );
    if (
      JSON.stringify(actual) !==
      JSON.stringify(
        [...manifest.files].sort((a, b) =>
          a.relativePath.localeCompare(b.relativePath),
        ),
      )
    )
      throw new Error('Backup file integrity check failed');
    let paused = false;
    await cp(source, temp, {
      recursive: true,
      filter: async (p) => {
        check();
        if (!paused && path.resolve(p) !== source) {
          paused = true;
          await testCheckpoint('restore-copy');
          check();
        }
        return path.resolve(p) !== path.join(source, 'manifest.json');
      },
    });
    check();
    const staged = await fileList(temp, '', check);
    if (JSON.stringify(staged) !== JSON.stringify(actual))
      throw new Error('Staged backup integrity check failed');
    check();
    const verified = await validateCluster(
      temp,
      (client) => {
        validatingClient = client;
      },
      check,
    );
    check();
    await writeFile(
      path.join(temp, '.azusa-last-healthy.json'),
      JSON.stringify({
        verifiedAt: new Date().toISOString(),
        appVersion: APP_VERSION,
      }),
    );
    check();
    if (!isActive) {
      if (await exists(target)) await rm(target, { recursive: true });
      await renameDirectory(temp, target, check);
    } else {
      movedOld = path.join(
        path.dirname(active),
        `db-replaced-${stamp()}-${randomUUID()}`,
      );
      await writeFile(
        journal,
        JSON.stringify({
          activeDbDir: active,
          replacedDir: movedOld,
          stagingDir: temp,
          startedAt: new Date().toISOString(),
        }),
      );
      check();
      await renameDirectory(active, movedOld, check);
      await testCheckpoint('promotion');
      if (options.faultInjectStep === 'after-move-old')
        throw new Error('Injected promotion failure');
      check();
      await renameDirectory(temp, active, check);
      check();
      await validateCluster(
        active,
        (client) => {
          validatingClient = client;
        },
        check,
      );
      check();
      await rm(journal, { force: true });
      check();
    }
    check();
    return {
      ok: true as const,
      backupId: manifest.backupId,
      restoredTo: target,
      ...verified,
      ...(movedOld ? { replacedDbPreserved: movedOld } : {}),
    };
  } catch (e) {
    if (movedOld && (await exists(movedOld))) {
      await rm(active, { recursive: true, force: true });
      await renameDirectory(movedOld, active);
      await rm(journal, { force: true });
    }
    await rm(temp, { recursive: true, force: true });
    throw e;
  } finally {
    await release().catch(() => {});
  }
}
export async function getBackupSummary(backupDir: string) {
  const entries = await completed(backupDir);
  const last = entries[0];
  return {
    lastBackupId: last?.id ?? null,
    lastBackupAt: last?.manifest.createdAt ?? null,
    lastBackupTrigger: last?.manifest.trigger ?? null,
    backupCount: entries.filter((entry) => entry.manifest.trigger === 'startup')
      .length,
  };
}
