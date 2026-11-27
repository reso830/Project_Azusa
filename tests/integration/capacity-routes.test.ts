import { PGlite } from '@electric-sql/pglite';
import { asc, eq } from 'drizzle-orm';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { GET } from '../../src/app/api/capacity/route';
import { PATCH } from '../../src/app/api/capacity/team-settings/route';
import * as velocity from '../../src/app/api/capacity/velocity-override/route';
import { POST as bulk } from '../../src/app/api/capacity/overhead-deductions/bulk/route';
import { PUT as deduction } from '../../src/app/api/capacity/overhead-deductions/route';
import {
  FoundationError,
  getCachedDbError,
  getDbContext,
} from '../../src/persistence/client';
import {
  categories,
  iterations,
  locations,
  members,
  memberTeamAssignments,
  overheadDeductions,
  pis,
  teams,
  trains,
} from '../../src/persistence/schema';

vi.mock(import('../../src/persistence/client'), async (original) => ({
  ...(await original()),
  getDbContext: vi.fn(),
  getCachedDbError: vi.fn(),
}));

let client: PGlite;
let db: PgliteDatabase & { $client: PGlite };

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client);
  await migrate(db, { migrationsFolder: 'src/persistence/migrations' });
}, 30000);
afterAll(async () => client?.close());
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getDbContext).mockResolvedValue({
    client,
    db,
    dbDir: '',
    backupDir: '',
    migrationsFolder: '',
    release: async () => {},
    startupBackup: { trigger: 'skipped_cold_start' },
  });
});

function request(method: string, suffix = '', body?: unknown) {
  return new Request(`http://127.0.0.1/api/capacity${suffix}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const query = (params: { teamId: string; piId: string }) =>
  `?${new URLSearchParams(params)}`;
const settingsRequest = (body: unknown) =>
  request('PATCH', '/team-settings', body);
const setVelocityRequest = (body: unknown) =>
  request('PUT', '/velocity-override', body);
const clearVelocityRequest = (search: string) =>
  request('DELETE', `/velocity-override${search}`);
const deductionRequest = (body: unknown) =>
  request('PUT', '/overhead-deductions', body);
const bulkRequest = (body: unknown) =>
  request('POST', '/overhead-deductions/bulk', body);

async function json(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(response.headers.get('content-type')).toContain('application/json');
  return response.json();
}

const errorCodes = {
  400: 'VALIDATION_ERROR',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  503: 'DB_UNAVAILABLE',
} as const;

async function expectError(
  response: Response,
  status: keyof typeof errorCodes,
  details: unknown = expect.any(Array),
  message: unknown = expect.any(String),
) {
  expect(await json(response, status)).toEqual({
    error: { code: errorCodes[status], message, details },
  });
}

async function fixture() {
  const code = crypto.randomUUID();
  const [art] = await db.insert(trains).values({ name: code }).returning();
  const trainId = art!.id;
  const [team] = await db
    .insert(teams)
    .values({ trainId, name: 'Palawan' })
    .returning();
  const [pi] = await db
    .insert(pis)
    .values({
      trainId,
      name: 'PI-2027.1',
      startDate: '2027-01-04',
      endDate: '2027-03-12',
    })
    .returning();
  const [sprint] = await db
    .insert(iterations)
    .values({
      piId: pi!.id,
      name: '2702',
      startDate: '2027-01-04',
      endDate: '2027-01-15',
    })
    .returning();
  const [location] = await db
    .insert(locations)
    .values({
      code,
      name: 'Manila',
      countryCode: 'PH',
      timeZone: 'Asia/Manila',
      calendarSource: 'manual',
    })
    .returning();
  const [member] = await db
    .insert(members)
    .values({
      locationId: location!.id,
      fullName: 'Andrea Santos',
      initials: 'AS',
      role: 'Team member',
    })
    .returning();
  const [category] = await db
    .insert(categories)
    .values({
      trainId,
      name: 'General work',
      shortLabel: 'GW',
      color: '#A39C93',
      kind: 'overhead',
    })
    .returning();
  const pair = { teamId: team!.id, piId: pi!.id };
  const cell = {
    teamId: pair.teamId,
    memberId: member!.id,
    iterationId: sprint!.id,
    categoryId: category!.id,
  };
  await db.insert(memberTeamAssignments).values({
    teamId: pair.teamId,
    memberId: cell.memberId,
    startDate: '2027-01-04',
  });
  return {
    trainId,
    pair,
    cell,
    firstBulk: {
      ...pair,
      mode: 'fixed_days',
      entries: [{ categoryId: cell.categoryId, value: 1 }],
    },
  };
}

it('routes all six operations and reads persisted changes back as uncached JSON', async () => {
  const { pair, cell, firstBulk } = await fixture();
  const read = async () => json(await GET(request('GET', query(pair))), 200);
  expect(await read()).toMatchObject({
    team: { id: pair.teamId, deductionMode: 'fixed_days' },
    pi: { id: pair.piId },
    velocity: { source: 'unset' },
    kpi: { piDevDaysRaw: 10 },
  });

  expect(
    await json(
      await PATCH(
        settingsRequest({
          teamId: pair.teamId,
          hoursPerDay: 7.5,
          seedNormalizedVelocity: 1,
        }),
      ),
      200,
    ),
  ).toEqual({
    team: expect.objectContaining({
      id: pair.teamId,
      hoursPerDay: 7.5,
      seedNormalizedVelocity: 1,
      updatedAt: expect.any(String),
    }),
  });
  expect(
    await json(
      await velocity.PUT(setVelocityRequest({ ...pair, velocity: 1.25 })),
      200,
    ),
  ).toEqual({
    override: {
      ...pair,
      velocity: 1.25,
      id: expect.any(String),
      updatedAt: expect.any(String),
    },
  });
  expect(await read()).toMatchObject({
    velocity: { source: 'pi_override', value: 1.25 },
  });
  expect(await json(await bulk(bulkRequest(firstBulk)), 200)).toEqual({
    ...pair,
    mode: 'fixed_days',
    appliedCount: 1,
    clearedCount: 0,
  });
  expect(await read()).toMatchObject({
    overheadCategories: [
      expect.objectContaining({
        categoryId: cell.categoryId,
        piTotalHours: 7.5,
      }),
    ],
    kpi: { piDevDaysRaw: 9 },
  });
  expect(
    await json(
      await deduction(deductionRequest({ ...cell, deductedHours: 4.25 })),
      200,
    ),
  ).toEqual({ deduction: { ...cell, deductedHours: 4.25, source: 'pi_plan' } });
  expect(await read()).toMatchObject({
    overheadCategories: [expect.objectContaining({ piTotalHours: 4.25 })],
  });
  expect(
    await json(
      await deduction(deductionRequest({ ...cell, deductedHours: 0 })),
      200,
    ),
  ).toEqual({ deduction: { ...cell, deductedHours: 0, source: null } });
  expect(
    await json(await velocity.DELETE(clearVelocityRequest(query(pair))), 200),
  ).toEqual({ ...pair, cleared: true });
  expect(await read()).toMatchObject({
    velocity: { source: 'manual_seed', value: 1 },
    kpi: { piDevDaysRaw: 10, piForecastSpDisplay: 10 },
  });
});

it('rejects malformed inputs before opening the database', async () => {
  const pair = { teamId: crypto.randomUUID(), piId: crypto.randomUUID() };
  const search = query(pair);
  const cell = {
    teamId: pair.teamId,
    memberId: crypto.randomUUID(),
    iterationId: crypto.randomUUID(),
    categoryId: crypto.randomUUID(),
    deductedHours: 4,
  };
  const entry = { categoryId: cell.categoryId, value: 1 };
  const fixed = { ...pair, mode: 'fixed_days', entries: [entry] };

  const duplicate = [
    { path: ['teamId'], message: 'Provide this parameter once.' },
  ];
  const duplicateSearch = `${search}&teamId=${pair.teamId}`;
  await expectError(
    await GET(request('GET', duplicateSearch)),
    400,
    duplicate,
    'Duplicate query parameter.',
  );
  await expectError(
    await velocity.DELETE(clearVelocityRequest(duplicateSearch)),
    400,
    duplicate,
    'Duplicate query parameter.',
  );
  await expectError(
    await PATCH(
      new Request('http://127.0.0.1/api/capacity/team-settings', {
        method: 'PATCH',
        body: '{',
      }),
    ),
    400,
    [],
    'Request body must be valid JSON.',
  );

  for (const response of [
    await GET(request('GET', `${search}&extra=true`)),
    await GET(request('GET', query({ ...pair, piId: 'invalid' }))),
    await GET(request('GET', `?teamId=${pair.teamId}`)),
    await velocity.DELETE(clearVelocityRequest(`${search}&actor=spoofed`)),
    await velocity.DELETE(
      clearVelocityRequest(query({ ...pair, teamId: 'invalid' })),
    ),
    await PATCH(settingsRequest({})),
    await PATCH(settingsRequest({ teamId: pair.teamId })),
    await PATCH(
      settingsRequest({
        teamId: pair.teamId,
        hoursPerDay: 8,
        createdBy: 'spoofed',
      }),
    ),
    await PATCH(
      request('PATCH', `/team-settings?teamId=${pair.teamId}`, {
        teamId: pair.teamId,
        hoursPerDay: 8,
      }),
    ),
    await velocity.PUT(
      setVelocityRequest({ ...pair, velocity: 1, createdBy: 'spoofed' }),
    ),
    await deduction(deductionRequest({ ...cell, createdBy: 'spoofed' })),
    await deduction(deductionRequest({ ...cell, memberId: 'invalid' })),
    await bulk(bulkRequest({ ...fixed, createdBy: 'spoofed' })),
    await bulk(
      bulkRequest({ ...fixed, entries: [{ ...entry, actor: 'spoofed' }] }),
    ),
    await bulk(bulkRequest({ ...fixed, entries: [] })),
    await bulk(bulkRequest({ ...fixed, entries: [entry, entry] })),
    await bulk(bulkRequest({ ...fixed, entries: [{ ...entry, value: 32 }] })),
    await bulk(
      bulkRequest({
        ...fixed,
        mode: 'percent',
        entries: [{ ...entry, value: 101 }],
      }),
    ),
  ]) {
    await expectError(response, 400);
  }
  for (const hoursPerDay of [0.001, 7.25, 25]) {
    await expectError(
      await PATCH(settingsRequest({ teamId: pair.teamId, hoursPerDay })),
      400,
    );
  }
  for (const value of [-1, 1001]) {
    await expectError(
      await PATCH(
        settingsRequest({ teamId: pair.teamId, seedNormalizedVelocity: value }),
      ),
      400,
    );
    await expectError(
      await velocity.PUT(setVelocityRequest({ ...pair, velocity: value })),
      400,
    );
  }
  for (const deductedHours of [-0.25, 744.25, 0.1]) {
    await expectError(
      await deduction(deductionRequest({ ...cell, deductedHours })),
      400,
    );
  }
  expect(getDbContext).not.toHaveBeenCalled();
});

it('reports missing resources and cross-ART or archived write conflicts', async () => {
  const { trainId, pair, cell, firstBulk } = await fixture();
  const foreign = await fixture();
  const missing = crypto.randomUUID();
  for (const response of [
    await GET(request('GET', query({ ...pair, teamId: missing }))),
    await GET(request('GET', query({ ...pair, piId: missing }))),
    await PATCH(settingsRequest({ teamId: missing, hoursPerDay: 8 })),
    await velocity.PUT(
      setVelocityRequest({ ...pair, piId: missing, velocity: 1 }),
    ),
    await velocity.DELETE(
      clearVelocityRequest(query({ ...pair, teamId: missing })),
    ),
    await deduction(
      deductionRequest({ ...cell, memberId: missing, deductedHours: 4 }),
    ),
    await deduction(
      deductionRequest({ ...cell, iterationId: missing, deductedHours: 4 }),
    ),
    await deduction(
      deductionRequest({ ...cell, categoryId: missing, deductedHours: 4 }),
    ),
    await bulk(
      bulkRequest({
        ...firstBulk,
        entries: [{ categoryId: missing, value: 1 }],
      }),
    ),
  ])
    await expectError(response, 404, []);

  const foreignPair = { ...pair, piId: foreign.pair.piId };
  for (const response of [
    await GET(request('GET', query(foreignPair))),
    await velocity.PUT(setVelocityRequest({ ...foreignPair, velocity: 1 })),
    await velocity.DELETE(clearVelocityRequest(query(foreignPair))),
    await bulk(bulkRequest({ ...firstBulk, ...foreignPair })),
    await bulk(bulkRequest({ ...firstBulk, mode: 'percent' })),
    await deduction(
      deductionRequest({
        ...cell,
        iterationId: foreign.cell.iterationId,
        deductedHours: 4,
      }),
    ),
    await deduction(
      deductionRequest({
        ...cell,
        categoryId: foreign.cell.categoryId,
        deductedHours: 4,
      }),
    ),
    await deduction(
      deductionRequest({
        ...cell,
        memberId: foreign.cell.memberId,
        deductedHours: 4,
      }),
    ),
  ])
    await expectError(response, 409, []);

  const archived = [
    (recordStatus: 'archived' | 'active') =>
      db.update(trains).set({ recordStatus }).where(eq(trains.id, trainId)),
    (recordStatus: 'archived' | 'active') =>
      db.update(teams).set({ recordStatus }).where(eq(teams.id, pair.teamId)),
    (recordStatus: 'archived' | 'active') =>
      db.update(pis).set({ recordStatus }).where(eq(pis.id, pair.piId)),
  ];
  for (const [index, setStatus] of archived.entries()) {
    await setStatus('archived');
    expect(
      await json(await GET(request('GET', query(pair))), 200),
    ).toMatchObject({ readOnly: true });
    await expectError(
      await velocity.PUT(setVelocityRequest({ ...pair, velocity: 1 })),
      409,
      [],
    );
    await expectError(
      await velocity.DELETE(clearVelocityRequest(query(pair))),
      409,
      [],
    );
    await expectError(await bulk(bulkRequest(firstBulk)), 409, []);
    await expectError(
      await deduction(deductionRequest({ ...cell, deductedHours: 4 })),
      409,
      [],
    );
    if (index < 2)
      await expectError(
        await PATCH(settingsRequest({ teamId: pair.teamId, hoursPerDay: 8 })),
        409,
        [],
      );
    await setStatus('active');
  }
  await db
    .update(members)
    .set({ recordStatus: 'archived' })
    .where(eq(members.id, cell.memberId));
  await expectError(
    await deduction(deductionRequest({ ...cell, deductedHours: 4 })),
    409,
    [],
    'Member is archived.',
  );
  await db
    .update(members)
    .set({ recordStatus: 'active', role: 'SM' })
    .where(eq(members.id, cell.memberId));
  await expectError(
    await deduction(deductionRequest({ ...cell, deductedHours: 4 })),
    409,
    [],
  );
  await db
    .update(members)
    .set({ role: 'Team member' })
    .where(eq(members.id, cell.memberId));

  await db
    .update(categories)
    .set({ recordStatus: 'archived' })
    .where(eq(categories.id, cell.categoryId));
  await expectError(
    await deduction(deductionRequest({ ...cell, deductedHours: 4 })),
    409,
    [],
  );
  await expectError(await bulk(bulkRequest(firstBulk)), 409, []);
  await db
    .update(categories)
    .set({
      recordStatus: 'active',
      kind: 'development',
      semanticRole: 'standard',
      defaultPct: 100,
    })
    .where(eq(categories.id, cell.categoryId));
  await expectError(
    await deduction(deductionRequest({ ...cell, deductedHours: 4 })),
    409,
    [],
  );
  await expectError(await bulk(bulkRequest(firstBulk)), 409, []);
  expect(
    await db
      .select()
      .from(overheadDeductions)
      .where(eq(overheadDeductions.teamId, pair.teamId)),
  ).toEqual([]);
});

it('returns the computed limit details and leaves existing bulk deductions intact', async () => {
  const { pair, cell, firstBulk } = await fixture();
  const [long] = await db
    .insert(iterations)
    .values({
      piId: pair.piId,
      name: 'Long Sprint',
      startDate: '2027-01-18',
      endDate: '2027-03-02',
    })
    .returning();
  await json(
    await PATCH(
      settingsRequest({
        teamId: pair.teamId,
        deductionMode: 'percent',
        hoursPerDay: 24,
      }),
    ),
    200,
  );
  await json(
    await deduction(deductionRequest({ ...cell, deductedHours: 4 })),
    200,
  );
  const readDeductions = () =>
    db
      .select()
      .from(overheadDeductions)
      .where(eq(overheadDeductions.teamId, pair.teamId))
      .orderBy(asc(overheadDeductions.id));
  const before = await readDeductions();
  await expectError(
    await bulk(
      bulkRequest({
        ...firstBulk,
        mode: 'percent',
        entries: [{ categoryId: cell.categoryId, value: 100 }],
      }),
    ),
    400,
    [
      {
        memberId: cell.memberId,
        memberName: 'Andrea Santos',
        iterationId: long!.id,
        iterationName: 'Long Sprint',
        categoryId: cell.categoryId,
        computedHours: 768,
        maxHours: 744,
      },
    ],
    'The computed overhead deduction exceeds 744 hours.',
  );
  expect(await readDeductions()).toEqual(before);
});

it('returns the recoverable DB error envelope across all routes', async () => {
  const pair = { teamId: crypto.randomUUID(), piId: crypto.randomUUID() };
  const error = new FoundationError(
    'query',
    'Database unavailable.',
    'Restart Azusa.',
  );
  const details = [{ stage: 'query', recoveryHint: 'Restart Azusa.' }];
  vi.mocked(getDbContext).mockRejectedValueOnce(error);
  await expectError(
    await GET(request('GET', query(pair))),
    503,
    details,
    'The organization database is unavailable.',
  );

  vi.mocked(getCachedDbError).mockReturnValue(error);
  const categoryId = crypto.randomUUID();
  for (const response of [
    await GET(request('GET', query(pair))),
    await PATCH(settingsRequest({ teamId: pair.teamId, hoursPerDay: 8 })),
    await velocity.PUT(setVelocityRequest({ ...pair, velocity: 1 })),
    await velocity.DELETE(clearVelocityRequest(query(pair))),
    await deduction(
      deductionRequest({
        teamId: pair.teamId,
        memberId: crypto.randomUUID(),
        iterationId: crypto.randomUUID(),
        categoryId,
        deductedHours: 4,
      }),
    ),
    await bulk(
      bulkRequest({
        ...pair,
        mode: 'fixed_days',
        entries: [{ categoryId, value: 1 }],
      }),
    ),
  ])
    await expectError(
      response,
      503,
      details,
      'The organization database is unavailable.',
    );
  expect(getDbContext).toHaveBeenCalledTimes(1);
});
