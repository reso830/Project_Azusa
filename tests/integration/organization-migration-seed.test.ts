import { assert, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';
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
import { resolveEffectiveLocationHolidays } from '../../src/domain/organization/holidays';
import {
  createManualBackup,
  restoreBackup,
} from '../../src/persistence/backup';
import { runMigrations } from '../../src/persistence/migrate';
import {
  reseedFutureLocationHolidays,
  seedReferenceData,
} from '../../src/persistence/seed';
import * as schema from '../../src/persistence/schema';
import { APP_VERSION } from '../../src/persistence/version';

const today = '2026-11-23';
const migrations = path.resolve('src/persistence/migrations');

it('upgrades F001 and seeds the pinned 2027 calendar without changing metadata', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-f002-upgrade-'));
  const dbDir = path.join(root, 'db');
  const baseline = path.join(root, 'baseline');
  const client = new PGlite(dbDir);
  try {
    await mkdir(path.join(baseline, 'meta'), { recursive: true });
    const journal = JSON.parse(
      await readFile(path.join(migrations, 'meta/_journal.json'), 'utf8'),
    );
    journal.entries = journal.entries.slice(0, 1);
    await writeFile(
      path.join(baseline, 'meta/_journal.json'),
      JSON.stringify(journal),
    );
    await copyFile(
      path.join(migrations, '0000_foundation_init.sql'),
      path.join(baseline, '0000_foundation_init.sql'),
    );
    const db = drizzle(client);
    await runMigrations({ db, dbDir, migrationsFolder: baseline });
    await db
      .update(schema.appMetadata)
      .set({
        value: {
          schemaVersion: '0000_foundation_init',
          appVersion: '0.1.0',
          initializedAt: '2026-11-23T00:00:00Z',
        },
      })
      .where(eq(schema.appMetadata.key, 'foundation.init'));
    await db.insert(schema.appMetadata).values({
      key: 'diagnostic.last_check',
      value: {
        note: 'Preserve me',
        checkedAt: '2026-11-23T01:00:00Z',
        checkCount: 1,
      },
    });
    const original = await db
      .select()
      .from(schema.appMetadata)
      .orderBy(schema.appMetadata.key);
    await runMigrations({ db, dbDir, today });
    expect(
      await db
        .select()
        .from(schema.appMetadata)
        .orderBy(schema.appMetadata.key),
    ).toEqual(original);
    const sites = await db.select().from(schema.locations);
    expect(sites.map((site) => site.code).sort()).toEqual([
      'AU-WA',
      'IN',
      'PH',
      'SG',
      'UK',
      'US-TX',
    ]);
    expect(sites.find((site) => site.code === 'IN')).toMatchObject({
      subdivisionCode: 'KA',
      calendarSource: 'Public holidays, IN · KA',
    });
    expect(
      (await db.select().from(schema.absenceTypes)).map((type) => [
        type.code,
        type.affectsCapacity,
      ]),
    ).toEqual(
      expect.arrayContaining([
        ['AL', true],
        ['SL', true],
        ['HD', true],
        ['BT', false],
        ['WFH', false],
        ['ON_SITE', false],
      ]),
    );
    for (const [code, date, confirmed] of [
      ['AU-WA', '2027-01-26', true],
      ['AU-WA', '2027-03-01', true],
      ['US-TX', '2027-01-18', true],
      ['US-TX', '2027-02-15', true],
      ['SG', '2027-02-08', true],
      ['SG', '2027-03-09', false],
      ['IN', '2027-01-26', true],
    ] as const) {
      const site = sites.find((site) => site.code === code)!;
      expect(
        await db
          .select()
          .from(schema.holidays)
          .where(eq(schema.holidays.locationId, site.id)),
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ date, confirmed, source: 'library' }),
        ]),
      );
    }
    const ph = sites.find((site) => site.code === 'PH')!;
    expect(
      (
        await db
          .select()
          .from(schema.holidays)
          .where(eq(schema.holidays.locationId, ph.id))
      ).some((row) => row.date === '2027-02-25'),
    ).toBe(false);
    expect(await db.select().from(schema.trains)).toEqual([]);
    expect(
      JSON.parse(
        await readFile(path.join(dbDir, '.azusa-last-healthy.json'), 'utf8'),
      ).appVersion,
    ).toBe('0.2.0');
  } finally {
    await client.close();
    await rm(root, { recursive: true, force: true });
  }
}, 60000);

it('preserves edits and overrides, including after jurisdiction change and rollover', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-f002-seed-'));
  const dbDir = path.join(root, 'db');
  const client = new PGlite(dbDir);
  try {
    const db = drizzle(client);
    await runMigrations({ db, dbDir, today });
    const [sg] = await db
      .select()
      .from(schema.locations)
      .where(eq(schema.locations.code, 'SG'));
    assert(sg);
    const holidayRows = () =>
      db
        .select()
        .from(schema.holidays)
        .where(eq(schema.holidays.locationId, sg.id))
        .orderBy(schema.holidays.id);
    const overrides = await db
      .insert(schema.holidays)
      .values([
        {
          locationId: sg.id,
          date: '2027-02-08',
          name: 'Company day',
          source: 'company',
        },
        {
          locationId: sg.id,
          date: '2027-03-09',
          name: 'Estimated leave day',
          source: 'manual',
          confirmed: false,
        },
      ])
      .returning();
    await db
      .update(schema.locations)
      .set({ name: 'Edited Singapore' })
      .where(eq(schema.locations.id, sg.id));
    const original = await holidayRows();
    expect(
      resolveEffectiveLocationHolidays(original).filter((row) =>
        overrides.some((override) => override.date === row.date),
      ),
    ).toEqual(expect.arrayContaining(overrides));
    expect(
      resolveEffectiveLocationHolidays(original).filter((row) =>
        overrides.some((override) => override.date === row.date),
      ),
    ).toHaveLength(2);
    await seedReferenceData(db, { today });
    expect(await holidayRows()).toEqual(original);
    expect(await db.select().from(schema.locations)).toHaveLength(6);
    expect(await db.select().from(schema.absenceTypes)).toHaveLength(6);
    expect(
      (
        await db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.id, sg.id))
      )[0],
    ).toMatchObject({
      name: 'Edited Singapore',
      lastRefreshedAt: sg.lastRefreshedAt,
    });

    await db.transaction(async (tx) => {
      const [changed] = await tx
        .update(schema.locations)
        .set({ countryCode: 'US', subdivisionCode: 'TX' })
        .where(eq(schema.locations.id, sg.id))
        .returning();
      assert(changed);
      await reseedFutureLocationHolidays(
        tx,
        changed,
        today,
        [2025, 2026, 2027, 2028],
      );
    });
    const past = original.filter((row) => row.date < today);
    const changedRows = await holidayRows();
    expect(changedRows.filter((row) => row.date < today)).toEqual(past);
    expect(changedRows).toEqual(
      expect.arrayContaining([
        ...overrides,
        expect.objectContaining({ source: 'library', date: '2027-01-18' }),
      ]),
    );
    expect(
      changedRows.some(
        (row) => row.source === 'library' && row.date === '2027-03-09',
      ),
    ).toBe(false);
    expect(
      (
        await db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.id, sg.id))
      )[0]?.librarySeedCutoffDate,
    ).toBe(today);

    await seedReferenceData(db, { today });
    expect(await holidayRows()).toEqual(changedRows);
    await db
      .update(schema.locations)
      .set({ seededYears: [2025, 2027, 2028] })
      .where(eq(schema.locations.id, sg.id));
    await seedReferenceData(db, { today: '2027-01-10' });
    const rolled = await holidayRows();
    expect(rolled.filter((row) => row.date < today)).toEqual(past);
    expect(rolled.some((row) => row.date.startsWith('2029-'))).toBe(true);
  } finally {
    await client.close();
    await rm(root, { recursive: true, force: true });
  }
}, 60000);

it('round-trips every F002 table through manual backup and sibling restore', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'azusa-f002-restore-'));
  const dbDir = path.join(root, 'db');
  const backupDir = path.join(root, 'backup');
  const restoredDir = path.join(root, 'restored');
  const client = new PGlite(dbDir);
  const db = drizzle(client);
  const snapshot = (database: typeof db) =>
    Promise.all([
      database.select().from(schema.trains).orderBy(schema.trains.id),
      database.select().from(schema.teams).orderBy(schema.teams.id),
      database.select().from(schema.members).orderBy(schema.members.id),
      database
        .select()
        .from(schema.memberTeamAssignments)
        .orderBy(schema.memberTeamAssignments.id),
      database.select().from(schema.pis).orderBy(schema.pis.id),
      database.select().from(schema.iterations).orderBy(schema.iterations.id),
      database.select().from(schema.locations).orderBy(schema.locations.id),
      database.select().from(schema.holidays).orderBy(schema.holidays.id),
      database
        .select()
        .from(schema.absenceTypes)
        .orderBy(schema.absenceTypes.id),
      database.select().from(schema.absences).orderBy(schema.absences.id),
    ]);
  try {
    let expected: Awaited<ReturnType<typeof snapshot>>;
    try {
      await runMigrations({ db, dbDir, today });
      const [train] = await db
        .insert(schema.trains)
        .values({ name: 'ART' })
        .returning();
      assert(train);
      const [team] = await db
        .insert(schema.teams)
        .values({ name: 'Team', trainId: train.id })
        .returning();
      assert(team);
      const [pi] = await db
        .insert(schema.pis)
        .values({
          name: 'PI',
          trainId: train.id,
          startDate: '2027-01-04',
          endDate: '2027-03-12',
        })
        .returning();
      assert(pi);
      await db.insert(schema.iterations).values({
        name: 'Sprint',
        piId: pi.id,
        startDate: '2027-01-04',
        endDate: '2027-01-15',
      });
      const [site] = await db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.code, 'PH'));
      assert(site);
      const [member] = await db
        .insert(schema.members)
        .values({
          fullName: 'Jane Lee',
          initials: 'JL',
          role: 'Team member',
          locationId: site.id,
        })
        .returning();
      assert(member);
      await db
        .insert(schema.memberTeamAssignments)
        .values({ memberId: member.id, teamId: team.id, startDate: today });
      const [type] = await db
        .select()
        .from(schema.absenceTypes)
        .where(eq(schema.absenceTypes.code, 'AL'));
      assert(type);
      await db.insert(schema.absences).values({
        memberId: member.id,
        absenceTypeId: type.id,
        date: '2027-01-05',
      });
      expected = await snapshot(db);
    } finally {
      await client.close();
    }
    const marker = await readFile(
      path.join(dbDir, '.azusa-last-healthy.json'),
      'utf8',
    );
    const backup = await createManualBackup({ dbDir, backupDir });
    await restoreBackup({
      from: backup.backupId,
      to: restoredDir,
      backupDir,
      activeDbDir: dbDir,
    });
    expect(
      JSON.parse(
        await readFile(
          path.join(restoredDir, '.azusa-last-healthy.json'),
          'utf8',
        ),
      ).appVersion,
    ).toBe(APP_VERSION);
    expect(
      await readFile(path.join(dbDir, '.azusa-last-healthy.json'), 'utf8'),
    ).toBe(marker);
    for (const folder of [restoredDir, dbDir]) {
      const opened = new PGlite(folder);
      try {
        expect(await snapshot(drizzle(opened))).toEqual(expected);
      } finally {
        await opened.close();
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 90000);
