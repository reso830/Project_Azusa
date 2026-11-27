import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, expect, it } from 'vitest';
import * as org from '../../src/application/organization/organization-service';
import * as cadence from '../../src/application/organization/cadence-service';
import * as calendar from '../../src/application/organization/calendar-reference-service';
import {
  absences,
  holidays,
  memberTeamAssignments,
} from '../../src/persistence/schema';
import { seedReferenceData } from '../../src/persistence/seed';

const options = { today: '2026-11-23', actor: 'local:test' };
const future = '2026-12-01';
let client: PGlite;
let db: PgliteDatabase;
beforeEach(async () => {
  client = new PGlite();
  db = drizzle(client);
  await migrate(db, { migrationsFolder: 'src/persistence/migrations' });
  await seedReferenceData(db, options);
});
afterEach(async () => {
  await client.close();
});

async function setup() {
  const train = await org.createTrain(db, { name: 'Payments' }, options);
  const other = await org.createTrain(db, { name: 'Platform' }, options);
  const a = await org.createTeam(db, { trainId: train.id, name: 'A' }, options);
  const b = await org.createTeam(db, { trainId: other.id, name: 'B' }, options);
  const c = await org.createTeam(db, { trainId: train.id, name: 'C' }, options);
  const locations = await calendar.listLocations(db);
  const sg = locations.find((location) => location.code === 'SG')!;
  const ph = locations.find((location) => location.code === 'PH')!;
  const add = (fields: object = {}, today = options.today) =>
    org.createMember(
      db,
      {
        teamId: a.id,
        locationId: sg.id,
        fullName: 'Jane Lee',
        initials: 'JL',
        role: 'PO',
        ...fields,
      },
      { ...options, today },
    );
  return { train, other, a, b, c, sg, ph, add };
}

it('manages ARTs, Teams and rosters with strict fields, defaults and reference guards', async () => {
  const { train, other, a, sg, ph, add } = await setup();
  expect(train.createdBy).toBe(options.actor);
  expect(a.hoursPerDay).toBe(8);
  expect(
    await org.updateTrain(db, train.id, { name: 'Payments ART' }),
  ).toMatchObject({ name: 'Payments ART' });
  await expect(
    org.createTrain(db, { name: ' payments art ' }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    org.createTeam(db, { name: ' a ', trainId: train.id }),
  ).rejects.toMatchObject({ status: 409 });
  for (const sprintOffsetWorkdays of [-2, 2]) {
    await expect(
      org.updateTeam(db, a.id, { sprintOffsetWorkdays }),
    ).rejects.toMatchObject({ status: 400 });
  }
  await expect(
    org.updateTeam(db, a.id, { trainId: other.id }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(org.deleteTrain(db, train.id)).rejects.toMatchObject({
    status: 409,
  });
  const empty = await org.createTrain(db, { name: 'Empty' });
  await org.deleteTrain(db, empty.id);

  const roster = await Promise.all(
    Array.from({ length: 15 }, (_, i) =>
      add({
        fullName: `Member ${i}`,
        locationId: i % 2 ? sg.id : ph.id,
        role: (['SM', 'PO', 'Admin', 'RTE'] as const)[i % 4],
      }),
    ),
  );
  expect(
    (await org.listMembers(db, { teamId: a.id }, options)).map(
      (m) => m.contributesToDevCapacity,
    ),
  ).toEqual(Array(15).fill(false));
  expect(await org.listTeams(db, { trainId: train.id }, options)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: a.id, memberCount: 15 }),
    ]),
  );
  await org.updateMember(db, roster[0]!.id, { nickname: 'Edited' }, options);
  expect(await org.listMembers(db, { teamId: a.id }, options)).toEqual(
    expect.arrayContaining([expect.objectContaining({ nickname: 'Edited' })]),
  );
  await org.updateTeam(db, a.id, { recordStatus: 'archived' }, options);
  await expect(add()).rejects.toMatchObject({ status: 409 });
  await org.updateTrain(db, train.id, { recordStatus: 'archived' });
  await expect(
    org.updateTeam(db, a.id, { recordStatus: 'active' }, options),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    org.createTeam(db, { name: 'New', trainId: train.id }),
  ).rejects.toMatchObject({ status: 409 });
  expect(await org.listTeams(db, { trainId: train.id })).toHaveLength(1);
});

it('resolves dated moves, corrections and equivalent cancellation paths', async () => {
  const { a, b, c, add } = await setup();
  const middle = await add({}, '2026-11-01');
  for (const effectiveDate of ['2026-11-01', '2026-11-10']) {
    await expect(
      org.updateMember(db, middle.id, { teamId: b.id, effectiveDate }, options),
    ).rejects.toMatchObject({ status: 400 });
  }
  const member = await add();
  const history = () =>
    db
      .select()
      .from(memberTeamAssignments)
      .where(eq(memberTeamAssignments.memberId, member.id));
  await org.updateMember(db, member.id, { teamId: b.id }, options);
  expect(await history()).toEqual([
    expect.objectContaining({ teamId: b.id, endDate: null }),
  ]);
  await org.updateMember(
    db,
    member.id,
    { teamId: a.id, effectiveDate: future },
    options,
  );
  expect(await org.listMembers(db, { teamId: b.id }, options)).toEqual([
    expect.objectContaining({
      id: member.id,
      pendingMove: { teamId: a.id, teamName: a.name, effectiveDate: future },
    }),
  ]);
  expect(
    await org.listMembers(db, { teamId: a.id, asOf: future }, options),
  ).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: member.id })]),
  );
  await expect(
    org.updateMember(db, member.id, { teamId: c.id }, options),
  ).rejects.toMatchObject({
    status: 400,
    message: expect.stringMatching(/cancel/i),
  });
  await expect(
    org.updateMember(
      db,
      member.id,
      { teamId: c.id, effectiveDate: '2026-12-02' },
      options,
    ),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    org.updateTeam(db, a.id, { recordStatus: 'archived' }, options),
  ).rejects.toMatchObject({ status: 409 });
  await org.updateMember(
    db,
    member.id,
    { teamId: c.id, effectiveDate: future },
    options,
  );
  await org.updateTeam(db, b.id, { recordStatus: 'archived' }, options);
  await expect(
    org.updateMember(db, middle.id, { teamId: b.id }, options),
  ).rejects.toMatchObject({ status: 409 });
  await org.updateMember(
    db,
    member.id,
    { teamId: b.id, effectiveDate: future },
    options,
  );
  expect(await history()).toEqual([
    expect.objectContaining({ teamId: b.id, endDate: null }),
  ]);
  await org.updateMember(
    db,
    member.id,
    { teamId: a.id, effectiveDate: future },
    options,
  );
  await org.cancelPendingMemberMove(db, member.id, options);
  expect(await history()).toEqual([
    expect.objectContaining({ teamId: b.id, endDate: null }),
  ]);
  await expect(
    org.cancelPendingMemberMove(db, member.id, options),
  ).rejects.toMatchObject({ status: 404 });
  await org.updateMember(
    db,
    member.id,
    { teamId: a.id, effectiveDate: future },
    options,
  );
  await expect(org.deleteTeam(db, b.id)).rejects.toMatchObject({ status: 409 });
  await org.deleteMember(db, member.id);
  expect(await history()).toEqual([]);
  await org.deleteTeam(db, b.id);
});

it('enforces canonical cadence and derives Team schedules and context', async () => {
  const { train, other, a, b } = await setup();
  const empty = await org.createTrain(db, { name: 'No Teams' });
  const dates = { startDate: '2027-01-04', endDate: '2027-03-12' };
  const pi = await cadence.createPi(db, {
    ...dates,
    trainId: train.id,
    name: 'PI 1',
  });
  const concurrent = await Promise.allSettled(
    ['PI 2A', 'PI 2B'].map((name) =>
      cadence.createPi(db, {
        trainId: train.id,
        name,
        startDate: '2027-03-15',
        endDate: '2027-03-31',
      }),
    ),
  );
  expect(
    concurrent.filter((result) => result.status === 'fulfilled'),
  ).toHaveLength(1);
  expect(concurrent).toContainEqual(
    expect.objectContaining({
      status: 'rejected',
      reason: expect.objectContaining({ status: 409 }),
    }),
  );
  await expect(
    cadence.createPi(db, { ...dates, trainId: train.id, name: 'Clash' }),
  ).rejects.toMatchObject({
    status: 409,
    message: expect.stringContaining(pi.name),
  });
  await cadence.createPi(db, { ...dates, trainId: other.id, name: 'PI 1' });
  expect(pi).toMatchObject({
    lifecycleStatus: 'planning',
    recordStatus: 'active',
  });
  const sprint = {
    name: '2702',
    kind: 'development',
    startDate: '2027-01-04',
    endDate: '2027-01-15',
  };
  const first = await cadence.createIteration(db, pi.id, sprint);
  await cadence.createIteration(db, pi.id, {
    ...sprint,
    name: 'Later',
    startDate: '2027-01-19',
    endDate: '2027-01-29',
  });
  for (const dates of [
    { startDate: '2027-01-09' },
    { endDate: '2027-01-16' },
  ]) {
    await expect(
      cadence.createIteration(db, pi.id, { ...sprint, ...dates }),
    ).rejects.toMatchObject({ status: 400 });
  }
  await expect(
    cadence.createIteration(db, pi.id, { ...sprint, name: 'Overlap' }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    cadence.createIteration(db, pi.id, {
      ...sprint,
      name: 'Outside',
      startDate: '2027-01-01',
    }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    cadence.updatePi(db, pi.id, { startDate: '2027-01-05' }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(cadence.deletePi(db, pi.id)).rejects.toMatchObject({
    status: 409,
  });
  const edited = await cadence.updateIteration(db, first.id, {
    name: 'Custom',
  });
  expect(edited).toMatchObject({
    name: 'Custom',
    startDate: sprint.startDate,
    endDate: sprint.endDate,
  });
  for (const [offset, expectedStart] of [
    [-1, '2027-01-01'],
    [0, '2027-01-04'],
    [1, '2027-01-05'],
  ] as const) {
    await org.updateTeam(db, a.id, { sprintOffsetWorkdays: offset }, options);
    const [one, two] = await cadence.listIterations(db, pi.id, {
      teamId: a.id,
    });
    expect(one).toMatchObject({
      startDate: sprint.startDate,
      teamSchedule: { scheduledStartDate: expectedStart },
    });
    expect(
      one!.teamSchedule!.scheduledEndDate <
        two!.teamSchedule!.scheduledStartDate,
    ).toBe(true);
  }
  await expect(
    cadence.listIterations(db, pi.id, { teamId: b.id }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    cadence.listIterations(db, pi.id, { teamId: 'bad-id' }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    cadence.listIterations(db, pi.id, { teamId: crypto.randomUUID() }),
  ).rejects.toMatchObject({ status: 404 });
  expect(
    (await cadence.getOrganizationContextTree(db)).trains.map(
      (train) => train.id,
    ),
  ).not.toContain(empty.id);
  await cadence.updatePi(db, pi.id, { recordStatus: 'archived' });
  await expect(
    cadence.createIteration(db, pi.id, sprint),
  ).rejects.toMatchObject({ status: 409 });
  const replacement = await cadence.createPi(db, {
    ...dates,
    trainId: train.id,
    name: 'Replacement',
  });
  await expect(
    cadence.updatePi(db, pi.id, { recordStatus: 'active' }),
  ).rejects.toMatchObject({ status: 409 });
  await cadence.deletePi(db, replacement.id);
  await org.updateTrain(db, train.id, { recordStatus: 'archived' });
  await expect(
    cadence.updatePi(db, pi.id, { recordStatus: 'active' }),
  ).rejects.toMatchObject({ status: 409 });
  await cadence.deleteIteration(db, first.id);
});

it('manages Location reference data and rejects only capacity-reducing overlaps', async () => {
  const { sg, ph, add } = await setup();
  const member = await add();
  await calendar.updateLocation(
    db,
    sg.id,
    { recordStatus: 'archived' },
    options,
  );
  await expect(add()).rejects.toMatchObject({ status: 409 });
  const elsewhere = await add({ locationId: ph.id });
  await expect(
    org.updateMember(db, elsewhere.id, { locationId: sg.id }, options),
  ).rejects.toMatchObject({ status: 409 });
  await org.updateMember(db, member.id, { recordStatus: 'archived' }, options);
  expect(
    await org.updateMember(db, member.id, { recordStatus: 'active' }, options),
  ).toMatchObject({ locationId: sg.id });
  await calendar.updateLocation(db, sg.id, { recordStatus: 'active' }, options);
  const site = await calendar.createLocation(
    db,
    {
      code: 'JP',
      name: 'Japan',
      countryCode: 'JP',
      timeZone: 'asia/tokyo',
      calendarSource: 'Japan',
    },
    options,
  );
  expect(site).toMatchObject({
    timeZone: 'Asia/Tokyo',
    seededYears: [2025, 2026, 2027, 2028],
  });
  await expect(
    calendar.createLocation(
      db,
      {
        code: 'jp',
        name: 'Japan',
        countryCode: 'JP',
        timeZone: 'Asia/Tokyo',
        calendarSource: 'Japan',
      },
      options,
    ),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    calendar.updateLocation(db, site.id, { code: 'NEW' }, options),
  ).rejects.toMatchObject({ status: 400 });
  await expect(calendar.deleteLocation(db, sg.id)).rejects.toMatchObject({
    status: 409,
  });
  const past = (await calendar.listLocationHolidays(db, sg.id)).filter(
    (row) => row.date < options.today,
  );
  const override = await calendar.createHoliday(
    db,
    {
      locationId: sg.id,
      date: '2027-02-08',
      name: 'Company day',
      source: 'company',
      confirmed: false,
    },
    options,
  );
  const manual = await calendar.createHoliday(
    db,
    {
      locationId: sg.id,
      date: '2027-03-09',
      name: 'Manual day',
      source: 'manual',
    },
    options,
  );
  expect(
    await calendar.listLocationHolidays(db, sg.id, { year: 2027 }),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: override.id, effective: true }),
      expect.objectContaining({
        date: override.date,
        source: 'library',
        effective: false,
      }),
    ]),
  );
  expect(
    await calendar.updateLocation(
      db,
      sg.id,
      { countryCode: 'US', subdivisionCode: 'TX' },
      options,
    ),
  ).toMatchObject({ librarySeedCutoffDate: options.today });
  const reseeded = await calendar.listLocationHolidays(db, sg.id);
  expect(reseeded.filter((row) => row.date < options.today)).toEqual(past);
  expect(reseeded).toEqual(
    expect.arrayContaining([
      expect.objectContaining(override),
      expect.objectContaining(manual),
    ]),
  );
  expect(
    (
      await db.select().from(holidays).where(eq(holidays.locationId, sg.id))
    ).some((row) => row.source === 'library' && row.date === manual.date),
  ).toBe(false);

  const types = await calendar.listAbsenceTypes(db);
  const request = (code: string, portion: string, date = future) => ({
    memberId: member.id,
    absenceTypeId: types.find((type) => type.code === code)!.id,
    date,
    portion,
  });
  await calendar.createAbsence(db, request('WFH', 'full'), options);
  await calendar.createAbsence(db, request('HD', 'pm'), options);
  await calendar.createAbsence(
    db,
    request('ON_SITE', 'full', '2026-12-02'),
    options,
  );
  await calendar.createAbsence(db, request('SL', 'pm', '2026-12-02'), options);
  const leave = await calendar.createAbsence(
    db,
    request('AL', 'full', '2026-12-03'),
    options,
  );
  await expect(
    calendar.createAbsence(db, request('SL', 'full', '2026-12-03'), options),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    calendar.createAbsence(db, request('HD', 'am', '2026-12-03'), options),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    calendar.createAbsence(
      db,
      { ...request('AL', 'full'), date: undefined },
      options,
    ),
  ).rejects.toMatchObject({ status: 400 });
  await calendar.updateAbsenceStatus(
    db,
    leave.id,
    { status: 'cancelled' },
    options,
  );
  await calendar.createAbsence(db, request('HD', 'am', '2026-12-03'), options);
  await expect(
    calendar.updateAbsenceStatus(db, leave.id, { status: 'active' }, options),
  ).rejects.toMatchObject({ status: 409 });
  await expect(org.deleteMember(db, member.id)).rejects.toMatchObject({
    status: 409,
  });
  expect(await calendar.listMemberAbsences(db, member.id)).toHaveLength(6);
  expect(
    (await db.select().from(absences).where(eq(absences.id, leave.id)))[0]
      ?.status,
  ).toBe('cancelled');
});

it('guards Member reactivation and allows a move while archived', async () => {
  const { a, b, add } = await setup();
  const member = await add();
  await org.updateMember(db, member.id, { recordStatus: 'archived' }, options);
  expect(await org.listTeams(db, {}, options)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: a.id, memberCount: 0 }),
    ]),
  );
  await org.updateTeam(db, a.id, { recordStatus: 'archived' }, options);
  await expect(
    org.updateMember(db, member.id, { recordStatus: 'active' }, options),
  ).rejects.toMatchObject({ status: 409 });
  await org.updateTeam(db, a.id, { recordStatus: 'active' }, options);
  expect(
    await org.updateMember(db, member.id, { recordStatus: 'active' }, options),
  ).toMatchObject({ recordStatus: 'active' });
  await org.updateMember(db, member.id, { recordStatus: 'archived' }, options);
  expect(
    await org.updateMember(db, member.id, { teamId: b.id }, options),
  ).toMatchObject({ teamId: b.id, recordStatus: 'archived' });
});

it('reopens the prior assignment when today’s move is corrected back', async () => {
  const { a, b, add } = await setup();
  const member = await add({}, '2026-11-01');
  await org.updateMember(db, member.id, { teamId: b.id }, options);
  await org.updateMember(db, member.id, { teamId: a.id }, options);
  expect(
    await db
      .select()
      .from(memberTeamAssignments)
      .where(eq(memberTeamAssignments.memberId, member.id)),
  ).toEqual([
    expect.objectContaining({
      teamId: a.id,
      startDate: '2026-11-01',
      endDate: null,
    }),
  ]);
});

it('validates holiday subdivisions and preserves archived Member leave history', async () => {
  const { sg, add } = await setup();
  const location = {
    code: 'US-TEST',
    name: 'US Test',
    countryCode: 'US',
    subdivisionCode: 'ZZ',
    timeZone: 'America/Chicago',
    calendarSource: 'US',
  };
  await expect(
    calendar.createLocation(db, location, options),
  ).rejects.toMatchObject({
    status: 400,
    details: [expect.objectContaining({ path: ['subdivisionCode'] })],
  });
  const texas = await calendar.createLocation(
    db,
    { ...location, subdivisionCode: 'TX' },
    options,
  );
  await expect(
    calendar.updateLocation(db, texas.id, { countryCode: 'GB' }, options),
  ).rejects.toMatchObject({ status: 400 });
  expect(await calendar.listLocations(db)).toContainEqual(
    expect.objectContaining({
      id: texas.id,
      countryCode: 'US',
      subdivisionCode: 'TX',
    }),
  );
  await expect(
    calendar.createHoliday(
      db,
      {
        locationId: sg.id,
        name: 'Fake library row',
        date: future,
        source: 'library',
      },
      options,
    ),
  ).rejects.toMatchObject({ status: 400 });
  const member = await add({}, '2026-11-01');
  await org.updateMember(db, member.id, { recordStatus: 'archived' }, options);
  const type = (await calendar.listAbsenceTypes(db)).find(
    (type) => type.code === 'AL',
  )!;
  expect(
    await calendar.createAbsence(
      db,
      { memberId: member.id, absenceTypeId: type.id, date: '2026-11-10' },
      options,
    ),
  ).toMatchObject({ memberId: member.id, date: '2026-11-10' });
});
