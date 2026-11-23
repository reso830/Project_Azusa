import { it, expect } from 'vitest';
import {
  mkdtemp,
  rm,
  readFile,
  writeFile,
  readdir,
  mkdir,
  utimes,
} from 'node:fs/promises';

import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { closeDbContext, getDbContext } from '../../src/persistence/client';

import { acquireDbLock } from '../../src/persistence/lock';
import { setupBackupFixture } from '../support/backup-fixture';
const fixture = setupBackupFixture();
const { seedDb, seedBackup } = fixture;

it('aborts when the lock is lost during the heartbeat grace period', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-lost-lock-'));
  const dbDir = path.join(root, 'db');
  try {
    let notified = false;
    const acquiring = acquireDbLock(dbDir, 'cli:backup', {
      onCompromised: () => {
        notified = true;
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
    await rm(`${dbDir}.azusa-lock.lock`, { recursive: true });
    await expect(acquiring).rejects.toThrow();
    expect(notified).toBe(true);
    expect((await readdir(root)).includes('db')).toBe(false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 30000);

it('returns 503 for both health endpoints after the server loses its lock', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-server-lost-'));
  const dbDir = path.join(root, 'db'),
    backupDir = path.join(root, 'backups');
  try {
    await getDbContext({ dbDir, backupDir });
    await rm(`${dbDir}.azusa-lock.lock`, { recursive: true });
    const { GET } = await import('../../src/app/api/health/route');
    let response = await GET(new Request('http://localhost/api/health'));
    for (let i = 0; i < 30 && response.status !== 503; i++) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      response = await GET(new Request('http://localhost/api/health'));
    }
    expect(response.status).toBe(503);
    expect((await response.json()).errors[0].stage).toBe('init');
    const { POST } = await import('../../src/app/api/health/check/route');
    const post = await POST(
      new Request('http://localhost/api/health/check', {
        method: 'POST',
        body: '{}',
      }),
    );
    expect(post.status).toBe(503);
    expect((await post.json()).stage).toBe('init');
  } finally {
    await closeDbContext();
    await rm(root, { recursive: true, force: true });
  }
}, 45000);

it('allows one stale-lock contender and rejects the other processes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-race-'));
  const dbDir = path.join(root, 'db');
  const lockDir = `${dbDir}.azusa-lock.lock`;
  try {
    await mkdir(lockDir);
    await utimes(
      lockDir,
      new Date(Date.now() - 30000),
      new Date(Date.now() - 30000),
    );
    const helper = path.join(root, 'contender.ts');
    await writeFile(
      helper,
      `import { acquireDbLock } from ${JSON.stringify(path.resolve('src/persistence/lock.ts'))};\n(async () => { try { const release = await acquireDbLock(process.env.TEST_DB!, 'cli:backup', { staleMs: 2000, onCompromised: () => process.exit(2) }); process.stdout.write('winner\\n'); await new Promise(r => process.stdin.once('data', r)); await release(); } catch { process.stdout.write('loser\\n'); process.exitCode = 1; } })();`,
    );
    let winner: ReturnType<typeof spawn> | undefined;
    let losingAttempts = 0;
    const releaseWinner = () => {
      if (winner && losingAttempts === 3) winner.stdin?.end('release');
    };
    const run = () =>
      new Promise<{ code: number | null; output: string }>(
        (resolve, reject) => {
          const child = spawn(
            process.execPath,
            [path.resolve('node_modules/tsx/dist/cli.mjs'), helper],
            { env: { ...process.env, TEST_DB: dbDir } },
          );
          let output = '';
          child.stdout.on('data', (chunk) => {
            output += String(chunk);
            if (output.includes('winner')) {
              winner = child;
              releaseWinner();
            }
          });
          child.on('error', reject);
          child.on('exit', (code) => {
            if (code === 1) {
              losingAttempts++;
              releaseWinner();
            }
            resolve({ code, output });
          });
        },
      );
    const results = await Promise.all(Array.from({ length: 4 }, run));
    expect(
      results.filter(
        (result) => result.code === 0 && result.output.includes('winner'),
      ),
    ).toHaveLength(1);
    expect(
      results.filter(
        (result) => result.code === 1 && result.output.includes('loser'),
      ),
    ).toHaveLength(3);
    const release = await acquireDbLock(dbDir, 'cli:backup', {
      onCompromised: (error) => {
        throw error;
      },
    });
    await release();
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 60000);

it('CLI lock loss cleans staging and rolls back an active promotion', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-cli-lost-'));
  const dbDir = path.join(root, 'db'),
    backupDir = path.join(root, 'backups');
  const target = path.join(root, 'restored');
  try {
    await seedDb(dbDir);
    const backup = await seedBackup(backupDir);
    const originalControl = await readFile(
      path.join(dbDir, 'global', 'pg_control'),
    );
    const runInterrupted = (
      script: string,
      args: string[],
      step: string,
      lockTarget: string,
    ) =>
      new Promise<{ code: number | null; stderr: string }>(
        (resolve, reject) => {
          const child = spawn(
            process.execPath,
            [path.resolve('node_modules/tsx/dist/cli.mjs'), script, ...args],
            {
              env: {
                ...process.env,
                NODE_ENV: 'test',
                AZUSA_ALLOW_TEST_FAULT_INJECTION: '1',
                AZUSA_TEST_LOCK_STEP: step,
                AZUSA_DB_DIR: dbDir,
                AZUSA_BACKUP_DIR: backupDir,
              },
            },
          );
          let stderr = '',
            removed = false;
          let removal: Promise<void> = Promise.resolve();
          child.stderr.on('data', (chunk) => {
            stderr += String(chunk);
            if (!removed && stderr.includes(`AZUSA_TEST_CHECKPOINT:${step}`)) {
              removed = true;
              removal = rm(`${lockTarget}.azusa-lock.lock`, {
                recursive: true,
              });
            }
          });
          const timeout = setTimeout(() => {
            child.kill();
            reject(new Error(`CLI timed out at ${step}: ${stderr}`));
          }, 150000); // Allow slow cluster copy/hash/validation within the test's 300 s budget.
          child.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
          child.on('exit', (code) => {
            clearTimeout(timeout);
            void removal.then(() => resolve({ code, stderr }), reject);
          });
        },
      );
    const backupResult = await runInterrupted(
      'scripts/db/backup.ts',
      [],
      'backup-copy',
      dbDir,
    );
    expect(backupResult.code).toBe(1);
    expect(backupResult.stderr).toContain('AZUSA_TEST_CHECKPOINT:backup-copy');
    expect(
      (await readdir(backupDir)).some((name) => name.startsWith('.tmp-')),
    ).toBe(false);
    const restoreResult = await runInterrupted(
      'scripts/db/restore.ts',
      ['--from', backup.backupId, '--to', target],
      'restore-copy',
      target,
    );
    expect(restoreResult.code).toBe(1);
    expect(restoreResult.stderr).toContain(
      'AZUSA_TEST_CHECKPOINT:restore-copy',
    );
    expect(
      (await readdir(root)).some((name) => name.startsWith('.restore-tmp-')),
    ).toBe(false);
    const validationTarget = path.join(root, 'validation-target');
    const validationResult = await runInterrupted(
      'scripts/db/restore.ts',
      ['--from', backup.backupId, '--to', validationTarget],
      'restore-validation',
      validationTarget,
    );
    expect(validationResult.code).toBe(1);
    expect(validationResult.stderr).toContain(
      'AZUSA_TEST_CHECKPOINT:restore-validation',
    );
    expect(
      (await readdir(root)).some((name) => name.startsWith('.restore-tmp-')),
    ).toBe(false);
    const promotionResult = await runInterrupted(
      'scripts/db/restore.ts',
      ['--from', backup.backupId, '--to', dbDir, '--force-overwrite-active'],
      'promotion',
      dbDir,
    );
    expect(promotionResult.code).toBe(1);
    expect(promotionResult.stderr).toContain('AZUSA_TEST_CHECKPOINT:promotion');
    expect(await readFile(path.join(dbDir, 'global', 'pg_control'))).toEqual(
      originalControl,
    );
    expect(
      (await readdir(root)).some(
        (name) =>
          name === '.azusa-promote-journal.json' ||
          name.startsWith('.restore-tmp-'),
      ),
    ).toBe(false);
  } finally {
    await closeDbContext();
    await rm(root, { recursive: true, force: true });
  }
}, 300000);

it('recovers a killed owner and rejects a malformed lock artifact', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-killed-'));
  const dbDir = path.join(root, 'db'),
    lockDir = `${dbDir}.azusa-lock.lock`;
  try {
    const helper = path.join(root, 'owner.ts');
    await writeFile(
      helper,
      `import { acquireDbLock } from ${JSON.stringify(path.resolve('src/persistence/lock.ts'))};\n(async () => { await acquireDbLock(process.env.TEST_DB!, 'cli:backup', { staleMs: 2000, onCompromised: () => process.exit(2) }); process.stdout.write('held\\n'); setInterval(() => {}, 1000); })();`,
    );
    const child = spawn(
      process.execPath,
      [path.resolve('node_modules/tsx/dist/cli.mjs'), helper],
      { env: { ...process.env, TEST_DB: dbDir } },
    );
    await new Promise<void>((resolve, reject) => {
      child.stdout.on('data', (data) => {
        if (String(data).includes('held')) resolve();
      });
      child.on('error', reject);
      child.on('exit', (code) =>
        reject(new Error(`owner exited early: ${code}`)),
      );
    });
    const exited = new Promise<void>((resolve) =>
      child.once('exit', () => resolve()),
    );
    child.kill('SIGKILL');
    await exited;
    await utimes(
      lockDir,
      new Date(Date.now() - 30000),
      new Date(Date.now() - 30000),
    );
    const release = await acquireDbLock(dbDir, 'cli:backup', {
      staleMs: 2000,
      onCompromised: (error) => {
        throw error;
      },
    });
    await release();
    await writeFile(lockDir, 'not a lock directory');
    await expect(
      acquireDbLock(dbDir, 'cli:backup', { onCompromised: () => {} }),
    ).rejects.toMatchObject({ code: 'ELOCKED' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 45000);

it('backup and active restore CLI report actionable lock contention', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-cli-contend-'));
  const dbDir = path.join(root, 'db'),
    backupDir = path.join(root, 'backups');
  try {
    await seedDb(dbDir);
    const backup = await seedBackup(backupDir);
    const release = await acquireDbLock(dbDir, 'server', {
      onCompromised: (error) => {
        throw error;
      },
    });
    try {
      const run = promisify(execFile);
      const env = {
        ...process.env,
        AZUSA_DB_DIR: dbDir,
        AZUSA_BACKUP_DIR: backupDir,
      };
      const cli = path.resolve('node_modules/tsx/dist/cli.mjs');
      const commands = [
        ['scripts/db/backup.ts'],
        [
          'scripts/db/restore.ts',
          '--from',
          backup.backupId,
          '--to',
          dbDir,
          '--force-overwrite-active',
        ],
      ];
      for (const args of commands) {
        const result = await run(process.execPath, [cli, ...args], {
          env,
        }).then(
          () => null,
          (error) => error as { code: number; stderr: string },
        );
        expect(result?.code).toBe(1);
        expect(JSON.parse(result!.stderr).error).toContain(
          'Stop the running Azusa server',
        );
      }
    } finally {
      await release();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 60000);
