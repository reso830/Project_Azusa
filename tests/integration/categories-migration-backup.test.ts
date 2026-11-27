import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { BackupManifestSchema } from '../../src/domain/health/schemas';
import { runMigrations } from '../../src/persistence/migrate';
import { APP_VERSION } from '../../src/persistence/version';

const migrationsFolder = path.resolve('src/persistence/migrations');
const today = '2026-11-24';
const f002Tables = [
  'app_metadata',
  'trains',
  'teams',
  'pis',
  'iterations',
  'members',
  'member_team_assignments',
  'locations',
  'holidays',
  'absence_types',
  'absences',
] as const;
const f003Tables = ['categories', 'team_category_allocations'] as const;
let root: string;
let dbDir: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'azusa-categories-'));
  dbDir = path.join(root, 'db');
});

afterEach(async () => {
  if (root) await rm(root, { recursive: true, force: true });
}, 30000);

async function withCluster<T>(
  directory: string,
  run: (client: PGlite) => Promise<T>,
) {
  const client = new PGlite(directory);
  try {
    return await run(client);
  } finally {
    await client.close();
  }
}

async function seedParents(client: PGlite) {
  await client.exec(`
    INSERT INTO trains (id, name) VALUES ('art', 'Payments ART');
    INSERT INTO teams (id, train_id, name) VALUES ('team', 'art', 'Palawan');
    INSERT INTO pis (id, train_id, name, start_date, end_date)
      VALUES ('pi', 'art', 'PI-2027.1', '2027-01-04', '2027-03-12');
  `);
}

async function seedAllocations(client: PGlite) {
  await client.exec(`
    INSERT INTO categories
      (id, train_id, name, short_label, color, kind, semantic_role, default_pct, sort_order, record_status)
      VALUES
        ('bugs', 'art', 'Bugs and Support', 'Support', '#C93A3A', 'development', 'maintenance_bugs', 20, 1, 'active'),
        ('feature', 'art', 'Feature development', 'Feature dev.', '#2E8B57', 'development', 'feature', 80, 0, 'active'),
        ('training', 'art', 'Training', 'Training', '#5C7A1F', 'overhead', NULL, NULL, 0, 'archived');
    INSERT INTO team_category_allocations (id, team_id, pi_id, category_id, override_pct)
      VALUES ('override', 'team', 'pi', 'bugs', 0);
  `);
}

async function snapshotRows(
  client: PGlite,
  tables: readonly (
    (typeof f002Tables)[number] | (typeof f003Tables)[number]
  )[],
) {
  const snapshot: Record<string, unknown[]> = {};
  for (const table of tables) {
    snapshot[table] = (
      await client.query(`SELECT * FROM "${table}" ORDER BY id`)
    ).rows;
  }
  return snapshot;
}

it('upgrades an F002 database in place without changing its rows', async () => {
  const baseline = path.join(root, 'f002-migrations');
  await mkdir(path.join(baseline, 'meta'), { recursive: true });
  const journal = JSON.parse(
    await readFile(
      path.join(migrationsFolder, 'meta', '_journal.json'),
      'utf8',
    ),
  );
  const f003Entry = journal.entries[2];
  journal.entries = journal.entries.slice(0, 2);
  await writeFile(
    path.join(baseline, 'meta', '_journal.json'),
    JSON.stringify(journal),
  );
  for (const tag of ['0000_foundation_init', '0001_organization_cadence']) {
    await copyFile(
      path.join(migrationsFolder, `${tag}.sql`),
      path.join(baseline, `${tag}.sql`),
    );
  }
  await withCluster(dbDir, async (client) => {
    const db = drizzle(client);
    await runMigrations({ db, dbDir, migrationsFolder: baseline, today });
    await seedParents(client);
    const before = await snapshotRows(client, f002Tables);
    expect(before.app_metadata).toHaveLength(1);

    journal.entries.push(f003Entry);
    await writeFile(
      path.join(baseline, 'meta', '_journal.json'),
      JSON.stringify(journal),
    );
    await copyFile(
      path.join(migrationsFolder, `${f003Entry.tag}.sql`),
      path.join(baseline, `${f003Entry.tag}.sql`),
    );
    await runMigrations({ db, dbDir, migrationsFolder: baseline, today });
    expect(await snapshotRows(client, f002Tables)).toEqual(before);
    expect(await snapshotRows(client, f003Tables)).toEqual({
      categories: [],
      team_category_allocations: [],
    });
  });
}, 90000);

it('enforces category and allocation SQL constraints and restricts referenced deletes', async () => {
  await withCluster(dbDir, async (client) => {
    await runMigrations({ db: drizzle(client), dbDir, today });
    await seedParents(client);
    await seedAllocations(client);
    const updates = [
      [
        "semantic_role = NULL WHERE id = 'bugs'",
        'categories_kind_fields_valid',
      ],
      ["default_pct = NULL WHERE id = 'bugs'", 'categories_kind_fields_valid'],
      ["default_pct = 101 WHERE id = 'bugs'", 'categories_kind_fields_valid'],
      [
        "semantic_role = 'standard' WHERE id = 'training'",
        'categories_kind_fields_valid',
      ],
      ["default_pct = 0 WHERE id = 'training'", 'categories_kind_fields_valid'],
      ["color = '#123' WHERE id = 'bugs'", 'categories_color_valid'],
      ["name = '  ' WHERE id = 'bugs'", 'categories_name_nonempty'],
      [
        "short_label = '  ' WHERE id = 'bugs'",
        'categories_short_label_nonempty',
      ],
      ["sort_order = -1 WHERE id = 'bugs'", 'categories_sort_order_valid'],
      [
        "record_status = 'other' WHERE id = 'bugs'",
        'categories_record_status_valid',
      ],
    ] as const;
    for (const [update, constraint] of updates) {
      await expect(
        client.exec(`UPDATE categories SET ${update}`),
      ).rejects.toMatchObject({
        code: '23514',
        constraint,
      });
    }
    await expect(
      client.exec("UPDATE categories SET kind = 'other' WHERE id = 'bugs'"),
    ).rejects.toMatchObject({ code: '23514' });
    await expect(
      client.exec(
        "UPDATE categories SET name = '  BUGS AND SUPPORT  ' WHERE id = 'feature'",
      ),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'categories_train_name_ci_unique',
    });
    await expect(
      client.exec(
        "UPDATE categories SET semantic_role = 'maintenance_bugs' WHERE id = 'feature'",
      ),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'categories_train_active_bugs_unique',
    });

    for (const overridePct of [-1, 101]) {
      await expect(
        client.query('UPDATE team_category_allocations SET override_pct = $1', [
          overridePct,
        ]),
      ).rejects.toMatchObject({
        code: '23514',
        constraint: 'team_cat_alloc_override_pct_valid',
      });
    }
    await expect(
      client.exec(`
      INSERT INTO team_category_allocations (id, team_id, pi_id, category_id, override_pct)
        VALUES ('duplicate', 'team', 'pi', 'bugs', 0)
    `),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'team_cat_alloc_unique',
    });

    // This ART has only one category reference, isolating the new ART FK.
    await client.exec(`
      INSERT INTO trains (id, name) VALUES ('other-art', 'Other ART');
      INSERT INTO categories (id, train_id, name, short_label, color, kind)
        VALUES ('other-category', 'other-art', 'Overhead', 'OH', '#123456', 'overhead');
    `);
    for (const [table, id, reference] of [
      ['trains', 'other-art', 'categories'],
      ['teams', 'team', 'team_category_allocations'],
      ['pis', 'pi', 'team_category_allocations'],
      ['categories', 'bugs', 'team_category_allocations'],
    ] as const) {
      await expect(
        client.query(`DELETE FROM "${table}" WHERE id = $1`, [id]),
      ).rejects.toMatchObject({ code: '23001', table: reference });
    }
    const foreignKeys = await client.query<{ confdeltype: string }>(`
      SELECT confdeltype FROM pg_constraint
      WHERE contype = 'f' AND conrelid IN ('categories'::regclass, 'team_category_allocations'::regclass)
    `);
    expect(foreignKeys.rows.map(({ confdeltype }) => confdeltype)).toEqual([
      'r',
      'r',
      'r',
      'r',
    ]);
  });
}, 90000);

it('round-trips category and allocation values through CLI backup and restore', async () => {
  const expected = await withCluster(dbDir, async (client) => {
    await runMigrations({ db: drizzle(client), dbDir, today });
    await seedParents(client);
    await seedAllocations(client);
    return snapshotRows(client, f003Tables);
  });
  const run = (script: string, ...args: string[]) =>
    promisify(execFile)(
      process.execPath,
      [path.resolve('node_modules/tsx/dist/cli.mjs'), script, ...args],
      {
        env: {
          ...process.env,
          AZUSA_DB_DIR: dbDir,
          AZUSA_BACKUP_DIR: path.join(root, 'backups'),
        },
      },
    );
  const backup = JSON.parse((await run('scripts/db/backup.ts')).stdout);
  expect(backup).toMatchObject({ ok: true, backupPath: expect.any(String) });
  const restoredDir = path.join(root, 'restored');
  const restore = await run(
    'scripts/db/restore.ts',
    '--from',
    backup.backupPath,
    '--to',
    restoredDir,
  );
  expect(JSON.parse(restore.stdout)).toMatchObject({ ok: true });

  const manifest = BackupManifestSchema.parse(
    JSON.parse(
      await readFile(path.join(backup.backupPath, 'manifest.json'), 'utf8'),
    ),
  );
  for (const { relativePath, sha256 } of manifest.files) {
    const bytes = await readFile(path.join(dbDir, relativePath));
    expect(createHash('sha256').update(bytes).digest('hex'), relativePath).toBe(
      sha256,
    );
  }
  const marker = await readFile(
    path.join(restoredDir, '.azusa-last-healthy.json'),
    'utf8',
  );
  expect(JSON.parse(marker)).toMatchObject({ appVersion: APP_VERSION });

  await withCluster(restoredDir, async (client) => {
    const restored = await snapshotRows(client, f003Tables);
    expect(restored).toEqual(expected);
    expect(restored.categories).toHaveLength(3);
    expect(restored.team_category_allocations).toEqual([
      expect.objectContaining({ category_id: 'bugs', override_pct: 0 }),
    ]);
  });
}, 90000);
