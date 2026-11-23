import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import {
  createStartupSnapshotIfNeeded,
  pruneCompletedStartupBackups,
  recoverInterruptedPromotionIfNeeded,
} from './backup';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { acquireDbLock, LOCK_CONTENTION_MESSAGE } from './lock';
import { runMigrations } from './migrate';
export type Stage = 'init' | 'backup' | 'migration' | 'query';
export class FoundationError extends Error {
  constructor(
    public stage: Stage,
    message: string,
    public recoveryHint: string,
  ) {
    super(message);
  }
}
const exists = async (p: string) =>
  access(p).then(
    () => true,
    () => false,
  );
type Context = {
  client: PGlite;
  db: ReturnType<typeof drizzle>;
  dbDir: string;
  backupDir: string;
  release: () => Promise<void>;
  migrationsFolder: string;
  startupBackup: Awaited<ReturnType<typeof createStartupSnapshotIfNeeded>>;
};
type State = { promise?: Promise<Context>; error?: FoundationError };
const store = globalThis as typeof globalThis & { __azusaDbState?: State };
export function getCachedDbError(): FoundationError | undefined {
  return store.__azusaDbState?.error;
}
export async function getDbContext(
  options: {
    dbDir?: string;
    backupDir?: string;
    migrationsFolder?: string;
    processType?: 'server' | 'cli:migrate';
    onCompromised?: (err: Error) => void;
  } = {},
): Promise<Context> {
  const state = (store.__azusaDbState ??= {});
  if (state.error) throw state.error;
  if (state.promise) return state.promise;
  state.promise = (async () => {
    const dbDir = path.resolve(
      options.dbDir ?? process.env.AZUSA_DB_DIR ?? '.azusa/data/db',
    );
    const backupDir = path.resolve(
      options.backupDir ??
        process.env.AZUSA_BACKUP_DIR ??
        '.azusa/data/backups',
    );
    const folder = path.resolve(
      options.migrationsFolder ?? 'src/persistence/migrations',
    );
    let client: PGlite | undefined;
    let release: (() => Promise<void>) | undefined;
    let stage: Stage = 'init';
    try {
      release = await acquireDbLock(dbDir, options.processType ?? 'server', {
        onCompromised: (err) => {
          state.error = new FoundationError(
            'init',
            err.message,
            'Restart and verify exclusive access.',
          );
          void client?.close().catch(() => {});
          options.onCompromised?.(err);
        },
      });
      const checkLock = () => {
        if (state.error) throw state.error;
      };
      const initialVersion = path.join(dbDir, 'PG_VERSION');
      if (await exists(initialVersion)) {
        const version = (await readFile(initialVersion, 'utf8')).trim();
        if (!/^\d+$/.test(version)) {
          // A journal may describe a partial promoted cluster; recover it before rejecting the version.
          try {
            await recoverInterruptedPromotionIfNeeded(dbDir, checkLock);
            const recovered = (await readFile(initialVersion, 'utf8')).trim();
            if (!/^\d+$/.test(recovered)) throw new Error('Invalid PG_VERSION');
          } catch {
            throw new Error('Invalid PG_VERSION');
          }
        }
      }
      stage = 'backup';
      await recoverInterruptedPromotionIfNeeded(dbDir, checkLock);
      checkLock();
      const existing = await exists(path.join(dbDir, 'PG_VERSION'));
      if (existing) {
        stage = 'init';
        const version = (
          await readFile(path.join(dbDir, 'PG_VERSION'), 'utf8')
        ).trim();
        if (!/^\d+$/.test(version)) throw new Error('Invalid PG_VERSION');
      }
      stage = 'backup';
      const startupBackup = await createStartupSnapshotIfNeeded(
        { dbDir, backupDir },
        checkLock,
      );
      checkLock();
      stage = 'init';
      client = new PGlite(dbDir);
      await client.waitReady;
      checkLock();
      const db = drizzle(client);
      stage = 'migration';
      await runMigrations({ db, dbDir, migrationsFolder: folder });
      checkLock();
      stage = 'backup';
      if (startupBackup.trigger !== 'skipped_unverified')
        await pruneCompletedStartupBackups(backupDir, 10, checkLock);
      checkLock();
      return {
        client,
        db,
        dbDir,
        backupDir,
        release,
        migrationsFolder: folder,
        startupBackup,
      };
    } catch (e) {
      await client?.close().catch(() => {});
      await release?.().catch(() => {});
      const locked = (e as { code?: string })?.code === 'ELOCKED';
      const err = locked
        ? new FoundationError(
            'init',
            LOCK_CONTENTION_MESSAGE,
            'Stop the running Azusa server or other database process and retry.',
          )
        : e instanceof FoundationError
          ? e
          : new FoundationError(
              stage,
              e instanceof Error ? e.message : String(e),
              'Inspect the local database and migration files.',
            );
      state.error = err;
      throw err;
    }
  })();
  return state.promise;
}
export async function closeDbContext() {
  const state = store.__azusaDbState;
  if (state?.promise) {
    try {
      const c = await state.promise;
      await c.client.close();
      await c.release();
    } catch {}
  }
  delete store.__azusaDbState;
}
export async function resetDbStateForTesting() {
  await closeDbContext();
}
