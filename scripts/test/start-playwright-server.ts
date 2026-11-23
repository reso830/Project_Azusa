import { rm, realpath, lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { getDbContext, closeDbContext } from '../../src/persistence/client';
import { acquirePlaywrightLock } from './acquire-playwright-lock';

async function main() {
  const root = await realpath(process.cwd());
  const dir = path.join(root, '.azusa', 'test-playwright');
  const azusa = path.dirname(dir);
  const parent = await realpath(azusa).catch(() => azusa);
  if (parent !== azusa || path.basename(dir) !== 'test-playwright')
    throw new Error('Unsafe test directory');
  const entry = await lstat(dir).catch(() => null);
  if (entry?.isSymbolicLink())
    throw new Error('Test directory must not be a symlink');
  const dbDir = path.join(dir, 'db');
  const backupDir = path.join(dir, 'backups');
  let compromised: Error | undefined;
  const release = await acquirePlaywrightLock(dbDir, (e) => {
    compromised = e;
  });
  try {
    if (compromised) throw compromised;
    for (const name of await readdir(dir)) {
      if (name === 'db.azusa-lock.lock' || name === 'db.azusa-owner.json')
        continue;
      const target = path.resolve(dir, name);
      if (path.dirname(target) !== dir)
        throw new Error('Unsafe test reset path');
      await rm(target, { recursive: true, force: true });
    }
  } finally {
    await release();
  }
  await getDbContext({ dbDir, backupDir });
  await closeDbContext();
  const child = spawn(
    process.execPath,
    [
      require.resolve('next/dist/bin/next'),
      'dev',
      '--hostname',
      '127.0.0.1',
      '--port',
      '3100',
    ],
    {
      stdio: 'inherit',
      env: { ...process.env, AZUSA_DB_DIR: dbDir, AZUSA_BACKUP_DIR: backupDir },
    },
  );
  for (const signal of ['SIGINT', 'SIGTERM'] as const)
    process.on(signal, () => child.kill(signal));
  child.on('exit', (code) => {
    process.exitCode = code ?? 1;
  });
  let initialized = false;
  for (let attempt = 0; attempt < 120 && child.exitCode === null; attempt++) {
    try {
      const response = await fetch('http://127.0.0.1:3100/api/health');
      if (response.ok) {
        initialized = true;
        break;
      }
    } catch {
      /* server is still starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!initialized) {
    child.kill();
    throw new Error('Playwright server failed to initialize');
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
