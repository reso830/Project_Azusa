import { it, expect } from 'vitest';
import { mkdtemp, mkdir, symlink, rm, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { acquireDbLock } from '../../src/persistence/lock';

it.each([
  'database alias',
  'parent alias',
  'parent alias before database creation',
])(
  'uses the canonical database lock through a %s',
  async (kind) => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-lock-alias-'));
    const realParent = path.join(root, 'real');
    const realDb = path.join(realParent, 'db');
    const alias = path.join(root, 'alias');
    let release: (() => Promise<void>) | undefined;
    try {
      await mkdir(realParent);
      if (!kind.includes('before')) await mkdir(realDb);
      await symlink(
        kind === 'database alias' ? realDb : realParent,
        alias,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
      const aliasDb =
        kind === 'database alias' ? alias : path.join(alias, 'db');
      release = await acquireDbLock(aliasDb, 'server', {
        onCompromised: (error) => {
          throw error;
        },
      });
      const contender = await acquireDbLock(realDb, 'cli:restore', {
        onCompromised: (error) => {
          throw error;
        },
      }).then(
        (release) => ({ release }),
        (error: unknown) => ({ error }),
      );
      if ('release' in contender) {
        await contender.release();
        throw new Error(
          'Filesystem aliases acquired independent database locks',
        );
      }
      expect(contender.error).toMatchObject({ code: 'ELOCKED' });
      expect(
        JSON.parse(await readFile(`${realDb}.azusa-owner.json`, 'utf8')),
      ).toMatchObject({ processType: 'server', pid: process.pid });
    } finally {
      await release?.();
      await rm(root, { recursive: true, force: true });
    }
  },
  20000,
);
