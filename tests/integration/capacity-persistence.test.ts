import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { and, asc, eq } from 'drizzle-orm';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { afterEach, beforeEach, expect, it } from 'vitest';
import {
  bulkApplyOverheadDeductions,
  clearTeamPiVelocityOverride,
  getTeamPiCapacity,
  setTeamPiVelocityOverride,
  updateTeamCapacitySettings,
  upsertOverheadDeduction,
} from '../../src/application/capacity/capacity-service';
import {
  deleteCategory,
  listCategories,
  updateCategory,
} from '../../src/application/categories/category-service';
import {
  deleteIteration,
  deletePi,
} from '../../src/application/organization/cadence-service';
import {
  deleteMember,
  deleteTeam,
} from '../../src/application/organization/organization-service';
import { runMigrations } from '../../src/persistence/migrate';
import {
  absenceTypes,
  absences,
  categories,
  holidays,
  iterations,
  locations,
  members,
  memberTeamAssignments,
  overheadDeductions,
  pis,
  teamCategoryAllocations,
  teams,
  trains,
} from '../../src/persistence/schema';
import { capacityGoldenFixture } from '../support/capacity-golden-fixture';

const fixture = capacityGoldenFixture();
const today = { today: fixture.today };
let root: string;
let client: PGlite;
let db: PgliteDatabase;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'azusa-capacity-service-'));
  client = new PGlite(path.join(root, 'db'));
  db = drizzle(client);
  await runMigrations({ db, dbDir: path.join(root, 'db'), ...today });
}, 90000);

afterEach(async () => {
  try {
    await client?.close();
  } finally {
    if (root) await rm(root, { recursive: true, force: true });
  }
}, 30000);

async function seedGolden() {
  const ids = new Map<string, string>();
  function id(key: string) {
    let value = ids.get(key);
    if (!value) {
      value = randomUUID();
      ids.set(key, value);
    }
    return value;
  }
  const trainId = id(fixture.team.trainId);
  const teamId = id(fixture.team.id);
  const piId = id(fixture.pi.id);
  await db.insert(trains).values({ id: trainId, name: fixture.team.trainName });
  await db.insert(teams).values({
    ...fixture.team,
    id: teamId,
    trainId,
  });
  await db.insert(pis).values({ ...fixture.pi, id: piId, trainId });
  await db.insert(iterations).values(
    fixture.iterations.map((sprint) => ({
      ...sprint,
      id: id(sprint.id),
      piId,
    })),
  );
  const locationIds = new Map(
    (await db.select().from(locations)).map((location) => [
      location.code,
      location.id,
    ]),
  );
  await db.insert(members).values(
    fixture.members.map((member) => ({
      ...member,
      id: id(member.memberId),
      locationId: locationIds.get(member.location.code)!,
      nickname: member.nickname ?? '',
      avatarColor: member.avatarColor ?? '#2F62C8',
    })),
  );
  await db.insert(memberTeamAssignments).values(
    fixture.assignments.map((row) => ({
      ...row,
      teamId,
      memberId: id(row.memberId),
    })),
  );
  // Keep the fixture's holiday calendar independent of seeded library versions.
  await db.delete(holidays);
  await db.insert(holidays).values(
    fixture.holidays.map((row) => ({
      ...row,
      id: id(row.id),
      locationId: locationIds.get(row.locationId)!,
    })),
  );
  const types = new Map(
    (await db.select().from(absenceTypes)).map((type) => [type.name, type.id]),
  );
  await db.insert(absences).values(
    fixture.absences.map((row) => ({
      ...row,
      id: id(row.id),
      memberId: id(row.memberId),
      absenceTypeId: types.get(row.name)!,
    })),
  );
  await db.insert(categories).values([
    ...fixture.allocation.items.map((row) => ({
      ...row,
      id: id(row.categoryId),
      trainId,
      kind: 'development' as const,
      defaultPct: row.artDefaultPct,
    })),
    ...fixture.overheadCategories.map((row) => ({
      ...row,
      id: id(row.categoryId),
      trainId,
      kind: 'overhead' as const,
    })),
  ]);
  await db.insert(teamCategoryAllocations).values(
    fixture.allocation.items.map((row) => ({
      categoryId: id(row.categoryId),
      teamId,
      piId,
      overridePct: row.overridePct!,
    })),
  );
  await db.insert(overheadDeductions).values(
    fixture.overheadDeductions.map((row) => ({
      ...row,
      teamId,
      memberId: id(row.memberId),
      iterationId: id(row.iterationId),
      categoryId: id(row.categoryId),
    })),
  );
  return { id, teamId, trainId, piId };
}

it('reads the canonical Palawan PI from real organization and allocation records', async () => {
  const { teamId, piId, id } = await seedGolden();
  const result = await getTeamPiCapacity(db, { teamId, piId }, today);
  expect(result.kpi).toMatchObject({
    piDevDaysRaw: 291.25,
    piForecastSpDisplay: 268,
    plannedSp: null,
  });
  expect(result.allocation.rows.map((row) => row.piBudgetSpDisplay)).toEqual([
    149, 40, 38, 21, 20,
  ]);
  expect(result.iterations[0]?.overheadByCategory).toContainEqual({
    categoryId: id('gw'),
    hours: 64,
    daysRaw: 8,
  });
  expect(result.excludedMembers).toEqual([
    expect.objectContaining({ role: 'SM' }),
    expect.objectContaining({ role: 'PO' }),
  ]);
}, 90000);

it('updates Team settings while stored deductions remain fixed in hours', async () => {
  const { teamId, piId, id } = await seedGolden();
  const deductionsBefore = await db
    .select()
    .from(overheadDeductions)
    .orderBy(asc(overheadDeductions.id));
  await expect(
    updateTeamCapacitySettings(
      db,
      {
        teamId,
        hoursPerDay: 7.5,
        deductionMode: 'percent',
      },
      { actor: 'local:capacity-test' },
    ),
  ).resolves.toMatchObject({
    team: {
      id: teamId,
      hoursPerDay: 7.5,
      deductionMode: 'percent',
      seedNormalizedVelocity: 0.92,
    },
  });
  expect(
    await db
      .select()
      .from(overheadDeductions)
      .orderBy(asc(overheadDeductions.id)),
  ).toEqual(deductionsBefore);
  expect(
    (await db.select().from(teams).where(eq(teams.id, teamId)))[0],
  ).toMatchObject({
    updatedBy: 'local:capacity-test',
  });
  const recalculated = await getTeamPiCapacity(db, { teamId, piId }, today);
  const sprint = recalculated.iterations[0]!;
  expect(sprint.overheadByCategory).toEqual(
    expect.arrayContaining([
      { categoryId: id('gw'), hours: 64, daysRaw: 64 / 7.5 },
      { categoryId: id('training'), hours: 32, daysRaw: 32 / 7.5 },
    ]),
  );
  expect(sprint.teamDevDaysRaw).toBeCloseTo(60);
  expect(sprint.forecastSpDisplay).toBe(55);
  for (const seedNormalizedVelocity of [0, null]) {
    await updateTeamCapacitySettings(db, { teamId, seedNormalizedVelocity });
    const view = await getTeamPiCapacity(db, { teamId, piId }, today);
    expect(view.velocity.value).toBe(seedNormalizedVelocity);
    expect(view.kpi.piForecastSpDisplay).toBe(seedNormalizedVelocity);
  }
}, 90000);

it('prorates bulk deductions across Team transfers and clears only submitted PI-plan rows', async () => {
  const { teamId, trainId, piId, id } = await seedGolden();
  const otherTeamId = id('cebu');
  const memberId = id('andrea');
  const iterationId = id('2702');
  const categoryId = id('gw');
  await db.insert(teams).values({ id: otherTeamId, trainId, name: 'Cebu' });
  await db
    .update(memberTeamAssignments)
    .set({ endDate: '2027-01-07' })
    .where(eq(memberTeamAssignments.memberId, memberId));
  await db.insert(memberTeamAssignments).values({
    memberId,
    teamId: otherTeamId,
    startDate: '2027-01-08',
    endDate: '2027-01-15',
  });
  const bulk = (targetTeam: string, value: number) =>
    bulkApplyOverheadDeductions(
      db,
      {
        teamId: targetTeam,
        piId,
        mode: 'fixed_days',
        entries: [{ categoryId, value }],
      },
      today,
    );
  await expect(bulk(teamId, 1)).resolves.toMatchObject({
    appliedCount: 36,
    clearedCount: 0,
  });
  await expect(bulk(otherTeamId, 1)).resolves.toMatchObject({
    appliedCount: 1,
    clearedCount: 0,
  });
  const cellRows = () =>
    db
      .select()
      .from(overheadDeductions)
      .where(
        and(
          eq(overheadDeductions.memberId, memberId),
          eq(overheadDeductions.iterationId, iterationId),
        ),
      );
  expect(await cellRows()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ teamId, categoryId, deductedHours: 3.25 }),
      expect.objectContaining({
        teamId: otherTeamId,
        categoryId,
        deductedHours: 4.75,
      }),
      expect.objectContaining({
        teamId,
        categoryId: id('training'),
        deductedHours: 4,
      }),
    ]),
  );
  expect(
    (
      await getTeamPiCapacity(db, { teamId: otherTeamId, piId }, today)
    ).overheadCategories.find((category) => category.categoryId === categoryId)
      ?.piTotalHours,
  ).toBe(4.75);
  const cell = { teamId, memberId, iterationId, categoryId };
  await expect(
    upsertOverheadDeduction(db, {
      ...cell,
      iterationId: id('2704'),
      deductedHours: 4,
    }),
  ).rejects.toMatchObject({
    status: 409,
    message: expect.stringContaining('not assigned'),
  });
  await expect(
    upsertOverheadDeduction(db, { ...cell, deductedHours: 2.25 }),
  ).resolves.toEqual({
    deduction: { ...cell, deductedHours: 2.25, source: 'pi_plan' },
  });
  await expect(
    upsertOverheadDeduction(db, { ...cell, deductedHours: 0 }),
  ).resolves.toEqual({
    deduction: { ...cell, deductedHours: 0, source: null },
  });
  await upsertOverheadDeduction(db, { ...cell, deductedHours: 2.25 });
  const protectedMemberId = id('ben');
  await db
    .update(overheadDeductions)
    .set({ source: 'sprint_adjusted' })
    .where(
      and(
        eq(overheadDeductions.teamId, teamId),
        eq(overheadDeductions.memberId, protectedMemberId),
        eq(overheadDeductions.iterationId, iterationId),
        eq(overheadDeductions.categoryId, categoryId),
      ),
    );
  for (const deductedHours of [0, 3]) {
    await expect(
      upsertOverheadDeduction(db, {
        ...cell,
        memberId: protectedMemberId,
        deductedHours,
      }),
    ).rejects.toThrow('Sprint-adjusted deductions cannot be edited');
  }
  await expect(bulk(teamId, 2)).resolves.toMatchObject({
    appliedCount: 35,
    clearedCount: 0,
  });
  await expect(bulk(teamId, 0)).resolves.toMatchObject({
    appliedCount: 0,
    clearedCount: 35,
  });
  expect(await cellRows()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        teamId: otherTeamId,
        categoryId,
        deductedHours: 4.75,
      }),
      expect.objectContaining({
        teamId,
        categoryId: id('training'),
        deductedHours: 4,
      }),
    ]),
  );
  expect(await cellRows()).toHaveLength(2);
  expect(
    await db
      .select()
      .from(overheadDeductions)
      .where(eq(overheadDeductions.source, 'sprint_adjusted')),
  ).toEqual([
    expect.objectContaining({ memberId: protectedMemberId, deductedHours: 8 }),
  ]);
}, 90000);

it('snaps percent deductions once and rejects invalid and overflowing bulk writes atomically', async () => {
  const { teamId, trainId, piId, id } = await seedGolden();
  const categoryId = id('gw');
  const entries = [{ categoryId, value: 10 }];
  const snapshot = () =>
    db.select().from(overheadDeductions).orderBy(asc(overheadDeductions.id));
  const before = await snapshot();
  const percent = { teamId, piId, mode: 'percent', entries };
  await expect(
    bulkApplyOverheadDeductions(db, percent, today),
  ).rejects.toMatchObject({ status: 409 });
  expect(() =>
    bulkApplyOverheadDeductions(
      db,
      { ...percent, entries: [{ categoryId, value: 101 }] },
      today,
    ),
  ).toThrow(expect.objectContaining({ status: 400 }));
  expect(await snapshot()).toEqual(before);
  await updateTeamCapacitySettings(db, { teamId, deductionMode: 'percent' });
  await expect(
    bulkApplyOverheadDeductions(db, percent, today),
  ).resolves.toMatchObject({
    appliedCount: 40,
    clearedCount: 0,
  });
  const ben = (view: Awaited<ReturnType<typeof getTeamPiCapacity>>) =>
    view.members.find((member) => member.memberId === id('ben'))!.cells[0]!;
  const prior = ben(await getTeamPiCapacity(db, { teamId, piId }, today));
  expect(prior.overheadDeductions).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ categoryId, deductedHours: 7.25 }),
      expect.objectContaining({ categoryId: id('training'), deductedHours: 4 }),
    ]),
  );
  const [annualLeave] = await db
    .select()
    .from(absenceTypes)
    .where(eq(absenceTypes.code, 'AL'));
  await db.insert(absences).values({
    memberId: id('ben'),
    absenceTypeId: annualLeave!.id,
    date: '2027-01-07',
  });
  const afterAbsence = ben(
    await getTeamPiCapacity(db, { teamId, piId }, today),
  );
  expect(afterAbsence.overheadDeductions).toEqual(prior.overheadDeductions);
  expect(afterAbsence.devDaysRaw).toBe(prior.devDaysRaw - 1);

  const longPiId = id('long-pi');
  const shortId = id('short-sprint');
  const longId = id('long-sprint');
  await db.insert(pis).values({
    id: longPiId,
    trainId,
    name: 'Long PI',
    startDate: '2027-04-05',
    endDate: '2027-05-28',
  });
  await db.insert(iterations).values([
    {
      id: shortId,
      piId: longPiId,
      name: 'Short',
      startDate: '2027-04-05',
      endDate: '2027-04-09',
    },
    {
      id: longId,
      piId: longPiId,
      name: 'Long',
      startDate: '2027-04-12',
      endDate: '2027-05-25',
    },
  ]);
  await updateTeamCapacitySettings(db, { teamId, hoursPerDay: 24 });
  await upsertOverheadDeduction(db, {
    teamId,
    memberId: id('andrea'),
    iterationId: shortId,
    categoryId,
    deductedHours: 4,
  });
  const beforeOverflow = await snapshot();
  await expect(
    bulkApplyOverheadDeductions(
      db,
      {
        ...percent,
        piId: longPiId,
        entries: [{ categoryId, value: 100 }],
      },
      today,
    ),
  ).rejects.toMatchObject({
    status: 400,
    code: 'VALIDATION_ERROR',
    details: [
      {
        memberId: id('andrea'),
        memberName: 'Andrea Santos',
        iterationId: longId,
        iterationName: 'Long',
        categoryId,
        computedHours: 768,
        maxHours: 744,
      },
    ],
  });
  expect(await snapshot()).toEqual(beforeOverflow);
}, 90000);

it('isolates velocity overrides by Team and PI and guards archived planning contexts', async () => {
  const { teamId, trainId, piId, id } = await seedGolden();
  const otherTeamId = id('cebu');
  const otherPiId = id('second-pi');
  await db.insert(teams).values({ id: otherTeamId, trainId, name: 'Cebu' });
  await db.insert(pis).values({
    id: otherPiId,
    trainId,
    name: 'PI-2027.2',
    startDate: '2027-04-05',
    endDate: '2027-06-11',
  });
  const pair = { teamId, piId };
  await expect(
    setTeamPiVelocityOverride(db, { ...pair, velocity: 0 }),
  ).resolves.toMatchObject({
    override: { ...pair, velocity: 0 },
  });
  const first = await setTeamPiVelocityOverride(db, { ...pair, velocity: 1 });
  await expect(
    setTeamPiVelocityOverride(db, { ...pair, velocity: 0 }),
  ).resolves.toMatchObject({
    override: { id: first.override.id, velocity: 0 },
  });
  await setTeamPiVelocityOverride(db, {
    ...pair,
    teamId: otherTeamId,
    velocity: 2.5,
  });
  await setTeamPiVelocityOverride(db, {
    ...pair,
    piId: otherPiId,
    velocity: 1.05,
  });
  expect((await getTeamPiCapacity(db, pair, today)).velocity).toMatchObject({
    value: 0,
    source: 'pi_override',
  });
  await expect(clearTeamPiVelocityOverride(db, pair)).resolves.toEqual({
    ...pair,
    cleared: true,
  });
  await expect(clearTeamPiVelocityOverride(db, pair)).resolves.toEqual({
    ...pair,
    cleared: true,
  });
  expect((await getTeamPiCapacity(db, pair, today)).velocity).toMatchObject({
    value: 0.92,
    source: 'manual_seed',
  });
  expect(
    (await getTeamPiCapacity(db, { teamId: otherTeamId, piId }, today)).velocity
      .value,
  ).toBe(2.5);
  expect(
    (await getTeamPiCapacity(db, { teamId, piId: otherPiId }, today)).velocity
      .value,
  ).toBe(1.05);

  const archivedChecks = [
    (status: 'archived' | 'active') =>
      db
        .update(trains)
        .set({ recordStatus: status })
        .where(eq(trains.id, trainId)),
    (status: 'archived' | 'active') =>
      db
        .update(teams)
        .set({ recordStatus: status })
        .where(eq(teams.id, teamId)),
    (status: 'archived' | 'active') =>
      db.update(pis).set({ recordStatus: status }).where(eq(pis.id, piId)),
  ];
  for (const [index, setStatus] of archivedChecks.entries()) {
    await setStatus('archived');
    expect((await getTeamPiCapacity(db, pair, today)).readOnly).toBe(true);
    if (index < 2) {
      await expect(
        updateTeamCapacitySettings(db, { teamId, hoursPerDay: 7.5 }),
      ).rejects.toMatchObject({ status: 409 });
    }
    await expect(
      setTeamPiVelocityOverride(db, { ...pair, velocity: 1 }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(clearTeamPiVelocityOverride(db, pair)).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      bulkApplyOverheadDeductions(
        db,
        {
          ...pair,
          mode: 'fixed_days',
          entries: [{ categoryId: id('gw'), value: 1 }],
        },
        today,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      upsertOverheadDeduction(db, {
        teamId,
        memberId: id('andrea'),
        iterationId: id('2702'),
        categoryId: id('gw'),
        deductedHours: 4,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await setStatus('active');
  }
  await db
    .update(pis)
    .set({ lifecycleStatus: 'closed' })
    .where(eq(pis.id, piId));
  expect((await getTeamPiCapacity(db, pair, today)).readOnly).toBe(false);
  await expect(
    setTeamPiVelocityOverride(db, { ...pair, velocity: 1 }),
  ).resolves.toMatchObject({ override: { velocity: 1 } });
}, 90000);

it('keeps archived Members in past capacity, rejects ineligible writes, and guards referenced records', async () => {
  const { teamId, trainId, piId, id } = await seedGolden();
  const memberId = id('andrea');
  const otherTrainId = id('foreign-art');
  const otherPiId = id('foreign-pi');
  const otherCategoryId = id('foreign-overhead');
  await db.insert(trains).values({ id: otherTrainId, name: 'Other ART' });
  await db.insert(pis).values({
    id: otherPiId,
    trainId: otherTrainId,
    name: 'Foreign PI',
    startDate: '2027-01-04',
    endDate: '2027-03-12',
  });
  await db.insert(categories).values({
    id: otherCategoryId,
    trainId: otherTrainId,
    kind: 'overhead',
    name: 'Other overhead',
    shortLabel: 'Other',
    color: '#2F62C8',
  });
  const cell = {
    teamId,
    memberId,
    iterationId: id('2702'),
    categoryId: id('gw'),
    deductedHours: 4,
  };
  await expect(
    getTeamPiCapacity(db, { teamId, piId: otherPiId }, today),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    getTeamPiCapacity(db, { teamId, piId: id('unknown') }, today),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    upsertOverheadDeduction(db, { ...cell, memberId: id('sm') }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    upsertOverheadDeduction(db, { ...cell, categoryId: id('dev-0') }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    upsertOverheadDeduction(db, { ...cell, categoryId: otherCategoryId }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    upsertOverheadDeduction(db, { ...cell, categoryId: id('missing') }),
  ).rejects.toMatchObject({ status: 404 });

  await db
    .update(members)
    .set({ recordStatus: 'archived' })
    .where(eq(members.id, memberId));
  const historical = await getTeamPiCapacity(
    db,
    { teamId, piId },
    { today: '2027-02-12' },
  );
  const andrea = historical.members.find(
    (member) => member.memberId === memberId,
  )!;
  expect(andrea.cells.map((sprint) => sprint.exclusionReason)).toEqual([
    null,
    null,
    'archived',
    'archived',
    'archived',
  ]);
  expect(andrea.cells[0]?.devDaysRaw).toBe(8.5);
  expect(historical.excludedMembers).toContainEqual(
    expect.objectContaining({
      memberId,
      exclusionReason: 'archived',
      excludedIterationIds: ['2706', '2708', '2710'].map(id),
    }),
  );
  await expect(upsertOverheadDeduction(db, cell)).rejects.toMatchObject({
    status: 409,
    message: 'Member is archived.',
  });

  await setTeamPiVelocityOverride(db, { teamId, piId, velocity: 1 });
  for (const [remove, message] of [
    [() => deleteTeam(db, teamId), 'This Team has overhead deductions.'],
    [() => deleteMember(db, memberId), 'This Member has overhead deductions.'],
    [
      () => deleteIteration(db, id('2702')),
      'This Iteration has overhead deductions.',
    ],
    [() => deletePi(db, piId), 'This PI has Team velocity overrides.'],
    [
      () => deleteCategory(db, id('gw')),
      'A category with overhead deductions cannot be deleted.',
    ],
    [
      () => updateCategory(db, id('gw'), { kind: 'development' }),
      'A category with overhead deductions cannot change kind.',
    ],
  ] as const) {
    await expect(remove()).rejects.toMatchObject({ status: 409, message });
  }
  const catalog = await listCategories(db, { trainId }, today);
  expect(catalog.categories).toContainEqual(
    expect.objectContaining({ id: id('gw'), isReferenced: true }),
  );
  await updateCategory(db, id('training'), { recordStatus: 'archived' });
  await expect(
    upsertOverheadDeduction(db, {
      ...cell,
      memberId: id('ben'),
      categoryId: id('training'),
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    (await getTeamPiCapacity(db, { teamId, piId }, today)).overheadCategories,
  ).toContainEqual(
    expect.objectContaining({
      categoryId: id('training'),
      piTotalHours: expect.any(Number),
    }),
  );
}, 90000);
