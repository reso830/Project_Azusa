import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
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

const migrationsFolder = path.resolve('src/persistence/migrations');
const today = '2026-11-26';
const legacyTables = [
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
  'categories',
  'team_category_allocations',
] as const;
const capacityTables = [
  'overhead_deductions',
  'team_pi_velocity_overrides',
] as const;
let root: string;
let dbDir: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'azusa-capacity-'));
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

async function seedCapacityParents(client: PGlite) {
  await client.exec(`
    INSERT INTO trains (id, name) VALUES ('art', 'Payments ART');
    INSERT INTO teams (id, train_id, name) VALUES
      ('team', 'art', 'Palawan'), ('other-team', 'art', 'Cebu');
    INSERT INTO pis (id, train_id, name, start_date, end_date) VALUES
      ('pi', 'art', 'PI-2027.1', '2027-01-04', '2027-03-12'),
      ('other-pi', 'art', 'PI-2027.2', '2027-04-05', '2027-06-11');
    INSERT INTO iterations (id, pi_id, name, start_date, end_date) VALUES
      ('sprint', 'pi', '2702', '2027-01-04', '2027-01-15');
    INSERT INTO members (id, location_id, full_name, initials, role)
      SELECT 'member', id, 'Andrea Santos', 'AS', 'Team member' FROM locations WHERE code = 'PH';
    INSERT INTO categories (id, train_id, name, short_label, color, kind)
      VALUES ('gw', 'art', 'General work', 'GW', '#A39C93', 'overhead'),
             ('training', 'art', 'Training', 'TR', '#5C7A1F', 'overhead');
  `);
}

async function snapshotRows(
  client: PGlite,
  tables: readonly (
    (typeof legacyTables)[number] | (typeof capacityTables)[number]
  )[],
) {
  const snapshot: Record<string, Record<string, unknown>[]> = {};
  for (const table of tables) {
    snapshot[table] = (
      await client.query<Record<string, unknown>>(
        `SELECT * FROM "${table}" ORDER BY id`,
      )
    ).rows;
  }
  return snapshot;
}

it('upgrades all F003 rows and normalizes only stale workday settings', async () => {
  const baseline = path.join(root, 'f003-migrations');
  await mkdir(path.join(baseline, 'meta'), { recursive: true });
  const journal = JSON.parse(
    await readFile(
      path.join(migrationsFolder, 'meta', '_journal.json'),
      'utf8',
    ),
  );
  journal.entries = journal.entries.slice(0, 3);
  await writeFile(
    path.join(baseline, 'meta', '_journal.json'),
    JSON.stringify(journal),
  );
  for (const tag of [
    '0000_foundation_init',
    '0001_organization_cadence',
    '0002_work_categories_allocation',
  ]) {
    await copyFile(
      path.join(migrationsFolder, `${tag}.sql`),
      path.join(baseline, `${tag}.sql`),
    );
  }

  await withCluster(dbDir, async (client) => {
    const db = drizzle(client);
    await runMigrations({ db, dbDir, migrationsFolder: baseline, today });
    await seedCapacityParents(client);
    await client.exec(`
      UPDATE teams SET hours_per_day = 7.25 WHERE id = 'team';
      INSERT INTO teams (id, train_id, name, hours_per_day) VALUES ('tiny-team', 'art', 'Leyte', 0.001);
      INSERT INTO member_team_assignments (id, member_id, team_id, start_date)
        VALUES ('assignment', 'member', 'team', '2027-01-04');
      INSERT INTO holidays (id, location_id, date, name, source, confirmed)
        SELECT 'holiday', id, '2027-01-05', 'Local holiday', 'manual', false FROM locations WHERE code = 'PH';
      INSERT INTO absences (id, member_id, absence_type_id, date, portion)
        SELECT 'absence', 'member', id, '2027-01-06', 'am' FROM absence_types WHERE code = 'AL';
      INSERT INTO categories (id, train_id, name, short_label, color, kind, semantic_role, default_pct)
        VALUES ('feature', 'art', 'Feature development', 'Feature', '#2E8B57', 'development', 'feature', 100);
      INSERT INTO team_category_allocations (id, team_id, pi_id, category_id, override_pct)
        VALUES ('allocation', 'team', 'pi', 'feature', 100);
    `);
    const before = await snapshotRows(client, legacyTables);
    for (const table of legacyTables)
      expect(before[table]?.length, table).toBeGreaterThan(0);

    await runMigrations({ db, dbDir, today });
    expect(await snapshotRows(client, legacyTables)).toEqual({
      ...before,
      teams: before.teams!.map((team) => ({
        ...team,
        hours_per_day:
          team.id === 'team'
            ? 7.5
            : team.id === 'tiny-team'
              ? 1
              : team.hours_per_day,
        deduction_mode: 'fixed_days',
        seed_normalized_velocity: null,
      })),
    });
    expect(await snapshotRows(client, capacityTables)).toEqual({
      overhead_deductions: [],
      team_pi_velocity_overrides: [],
    });
  });
}, 90000);

it('enforces capacity SQL bounds, scoped uniqueness, and restricted foreign keys', async () => {
  await withCluster(dbDir, async (client) => {
    await runMigrations({ db: drizzle(client), dbDir, today });
    await seedCapacityParents(client);
    await client.exec(`
      INSERT INTO overhead_deductions (id, member_id, team_id, iteration_id, category_id, deducted_hours) VALUES
        ('first', 'member', 'team', 'sprint', 'gw', 8),
        ('second', 'member', 'other-team', 'sprint', 'gw', 3.25);
      INSERT INTO team_pi_velocity_overrides (id, team_id, pi_id, velocity) VALUES
        ('velocity', 'team', 'pi', 1.05), ('other-velocity', 'team', 'other-pi', 0);
    `);
    for (const [table, column, values, constraint] of [
      [
        'teams',
        'hours_per_day',
        [0.001, 7.25, 25],
        'teams_hours_per_day_valid',
      ],
      ['teams', 'deduction_mode', ['other'], 'teams_deduction_mode_valid'],
      [
        'teams',
        'seed_normalized_velocity',
        [-1, 1001, 'NaN'],
        'teams_seed_normalized_velocity_valid',
      ],
      [
        'overhead_deductions',
        'deducted_hours',
        [-0.25, 744.25, 0.1, 'NaN'],
        'overhead_deductions_hours_valid',
      ],
      [
        'overhead_deductions',
        'source',
        ['other'],
        'overhead_deductions_source_valid',
      ],
      [
        'team_pi_velocity_overrides',
        'velocity',
        [-1, 1001, 'NaN'],
        'team_pi_velocity_override_velocity_valid',
      ],
    ] as const) {
      for (const value of values) {
        await expect(
          client.query(`UPDATE "${table}" SET "${column}" = $1`, [value]),
        ).rejects.toMatchObject({ code: '23514', constraint });
      }
    }
    await expect(
      client.exec(`
      INSERT INTO overhead_deductions (id, member_id, team_id, iteration_id, category_id, deducted_hours)
        VALUES ('duplicate', 'member', 'team', 'sprint', 'gw', 0.25)
    `),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'overhead_deductions_member_team_iter_cat_unique',
    });
    await expect(
      client.exec(`
      INSERT INTO team_pi_velocity_overrides (id, team_id, pi_id, velocity)
        VALUES ('duplicate', 'team', 'pi', 1)
    `),
    ).rejects.toMatchObject({
      code: '23505',
      constraint: 'team_pi_velocity_override_unique',
    });

    for (const [table, id, reference] of [
      ['members', 'member', 'overhead_deductions'],
      ['teams', 'other-team', 'overhead_deductions'],
      ['iterations', 'sprint', 'overhead_deductions'],
      ['categories', 'gw', 'overhead_deductions'],
      ['pis', 'other-pi', 'team_pi_velocity_overrides'],
    ] as const) {
      await expect(
        client.query(`DELETE FROM "${table}" WHERE id = $1`, [id]),
      ).rejects.toMatchObject({ code: '23001', table: reference });
    }
    const { rows } = await client.query<{ confdeltype: string }>(`
      SELECT confdeltype FROM pg_constraint
      WHERE contype = 'f'
        AND conrelid IN ('overhead_deductions'::regclass, 'team_pi_velocity_overrides'::regclass)
    `);
    expect(rows.map(({ confdeltype }) => confdeltype)).toEqual(
      Array(6).fill('r'),
    );
  });
}, 90000);

it('round-trips capacity settings, deductions, and velocity through the CLI', async () => {
  const tables = ['teams', ...capacityTables] as const;
  const expected = await withCluster(dbDir, async (client) => {
    await runMigrations({ db: drizzle(client), dbDir, today });
    await seedCapacityParents(client);
    await client.exec(`
      UPDATE teams SET deduction_mode = 'percent', seed_normalized_velocity = 0.92, hours_per_day = 7.5 WHERE id = 'team';
      INSERT INTO overhead_deductions (id, member_id, team_id, iteration_id, category_id, deducted_hours, source) VALUES
        ('first', 'member', 'team', 'sprint', 'gw', 8, 'pi_plan'),
        ('second', 'member', 'team', 'sprint', 'training', 4, 'pi_plan'),
        ('third', 'member', 'other-team', 'sprint', 'gw', 3.25, 'sprint_adjusted');
      INSERT INTO team_pi_velocity_overrides (id, team_id, pi_id, velocity)
        VALUES ('velocity', 'team', 'pi', 1.05);
    `);
    return snapshotRows(client, tables);
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
  const restored = JSON.parse(restore.stdout);
  expect(restored).toMatchObject({ ok: true, restoredTo: expect.any(String) });
  expect(await realpath(restored.restoredTo)).toBe(await realpath(restoredDir));
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
  expect(JSON.parse(marker)).toMatchObject({ appVersion: '0.4.0' });
  await withCluster(restoredDir, async (client) => {
    const restored = await snapshotRows(client, tables);
    expect(restored).toEqual(expected);
    expect(restored.teams).toHaveLength(2);
    expect(
      restored.overhead_deductions?.map(({ deducted_hours }) => deducted_hours),
    ).toEqual([8, 4, 3.25]);
    expect(restored.team_pi_velocity_overrides).toEqual([
      expect.objectContaining({ id: 'velocity', velocity: 1.05 }),
    ]);
  });
}, 90000);
