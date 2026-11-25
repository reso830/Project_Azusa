import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import * as catalog from '../../src/app/api/categories/route';
import * as category from '../../src/app/api/categories/[id]/route';
import { POST as reorder } from '../../src/app/api/categories/reorder/route';
import { POST as sample } from '../../src/app/api/categories/sample/route';
import { PUT as defaults } from '../../src/app/api/categories/defaults/route';
import * as allocations from '../../src/app/api/categories/allocations/route';
import {
  FoundationError,
  getCachedDbError,
  getDbContext,
} from '../../src/persistence/client';
import { pis, teams, trains } from '../../src/persistence/schema';

// Pin the server date so drift results do not depend on when the suite runs.
vi.mock(import('../../src/domain/calendar/iso-week'), async (original) => ({
  ...(await original()),
  getServerTodayIsoDate: () => '2026-11-24',
}));

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
});
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
  return new Request(`http://127.0.0.1/api/categories${suffix}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const context = (id: string) => ({ params: Promise.resolve({ id }) });

async function json(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toBe('no-store');
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
) {
  expect(await json(response, status)).toEqual({
    error: { code: errorCodes[status], message: expect.any(String), details },
  });
}

async function fixture() {
  const [art] = await db
    .insert(trains)
    .values({ name: crypto.randomUUID() })
    .returning();
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
  const pair = { teamId: team!.id, piId: pi!.id };
  return {
    trainId,
    pair,
    pairQuery: `/allocations?${new URLSearchParams(pair)}`,
  };
}

type CategoryDto = {
  id: string;
  trainId: string;
  kind: 'development' | 'overhead';
  defaultPct: number | null;
};
async function loadSample(trainId: string) {
  const result = await json(
    await sample(request('POST', '/sample', { trainId })),
    201,
  );
  const categories: CategoryDto[] = result.categories;
  const development = categories.filter(({ kind }) => kind === 'development');
  const overhead = categories.filter(({ kind }) => kind === 'overhead');
  expect(result).toMatchObject({
    trainId,
    totalCategoryCount: 7,
    activeDevelopmentTotalPct: 100,
  });
  return { development, overhead };
}
const makeCategory = (trainId: string) => ({
  trainId,
  name: 'Extra',
  shortLabel: 'EX',
  color: '#123456',
  kind: 'overhead',
});

it('routes every operation and returns uncached JSON', async () => {
  const { trainId, pair, pairQuery } = await fixture();
  expect(
    await json(await catalog.GET(request('GET', `?trainId=${trainId}`)), 200),
  ).toMatchObject({ artConfigStatus: 'not_configured', categories: [] });
  const { development, overhead } = await loadSample(trainId);
  const created = await json(
    await catalog.POST(request('POST', '', makeCategory(trainId))),
    201,
  );
  expect(created).toMatchObject({
    trainId,
    kind: 'overhead',
    defaultPct: null,
  });
  expect(
    await json(
      await category.PATCH(
        request('PATCH', `/${created.id}`, {
          name: 'Renamed',
          recordStatus: 'archived',
        }),
        context(created.id),
      ),
      200,
    ),
  ).toMatchObject({ name: 'Renamed', recordStatus: 'archived' });
  for (const includeArchived of [false, true]) {
    const listed = await json(
      await catalog.GET(
        request(
          'GET',
          `?trainId=${trainId}&includeArchived=${includeArchived}`,
        ),
      ),
      200,
    );
    expect(
      listed.categories.some(({ id }: CategoryDto) => id === created.id),
    ).toBe(includeArchived);
  }
  const orderedIds = overhead.map(({ id }) => id).reverse();
  const reordered = await json(
    await reorder(
      request('POST', '/reorder', { trainId, kind: 'overhead', orderedIds }),
    ),
    200,
  );
  expect(
    reordered.categories
      .filter(({ kind }: CategoryDto) => kind === 'overhead')
      .map(({ id }: CategoryDto) => id),
  ).toEqual(orderedIds);
  const deleted = await json(
    await category.DELETE(
      request('DELETE', `/${created.id}`),
      context(created.id),
    ),
    200,
  );
  expect(deleted).toEqual({ deleted: true, id: created.id });

  const values = [45, 20, 18, 10, 7];
  const savedDefaults = await json(
    await defaults(
      request('PUT', '/defaults', {
        trainId,
        allocations: development.map(({ id }, index) => ({
          categoryId: id,
          defaultPct: values[index],
        })),
      }),
    ),
    200,
  );
  expect(savedDefaults).toMatchObject({
    activeDevelopmentTotalPct: 100,
    artDefaultsValid: true,
  });
  const inherited = await json(
    await allocations.GET(request('GET', pairQuery)),
    200,
  );
  expect(inherited).toMatchObject({
    ...pair,
    isValid: true,
    effectiveTotalPct: 100,
  });
  const overrides = development.map(({ id }, index) => ({
    categoryId: id,
    overridePct: [52, null, null, null, 0][index],
  }));
  const saved = await json(
    await allocations.PUT(
      request('PUT', '/allocations', { ...pair, overrides }),
    ),
    200,
  );
  expect(saved.items.at(-1)).toMatchObject({
    overridePct: 0,
    effectivePct: 0,
    source: 'override',
  });
  const listed = await json(
    await catalog.GET(request('GET', `?trainId=${trainId}`)),
    200,
  );
  expect(listed.categories).toHaveLength(7);
  for (const entry of listed.categories) {
    expect(entry.isReferenced, entry.name).toBe(
      overrides.some(
        ({ categoryId, overridePct }) =>
          categoryId === entry.id && overridePct !== null,
      ),
    );
  }
  const reset = await json(
    await allocations.DELETE(request('DELETE', pairQuery)),
    200,
  );
  expect(
    reset.items.every(({ source }: { source: string }) => source === 'inherit'),
  ).toBe(true);
});

it('rejects malformed inputs before opening the database and exposes the recoverable 503 envelope', async () => {
  const id = crypto.randomUUID();
  for (const response of [
    await catalog.GET(request('GET', '?trainId=bad')),
    await catalog.GET(request('GET', `?trainId=${id}&includeArchived=yes`)),
    await catalog.GET(request('GET', `?trainId=${id}&trainId=${id}`)),
    await catalog.GET(request('GET', `?trainId=${id}&extra=true`)),
    await catalog.POST(
      new Request('http://127.0.0.1/api/categories', {
        method: 'POST',
        body: '{',
      }),
    ),
    await catalog.POST(
      request('POST', '', { ...makeCategory(id), createdBy: 'spoofed' }),
    ),
    await catalog.POST(
      request('POST', '', {
        ...makeCategory(id),
        kind: 'development',
        semanticRole: 'standard',
        defaultPct: 0,
      }),
    ),
    await category.PATCH(
      request('PATCH', '/bad', { name: 'Valid' }),
      context('bad'),
    ),
    await category.DELETE(request('DELETE', `/${id}?extra=true`), context(id)),
    await reorder(
      request('POST', '/reorder', {
        trainId: id,
        kind: 'overhead',
        orderedIds: [id, id],
      }),
    ),
    await sample(request('POST', '/sample?extra=true', { trainId: id })),
    await defaults(
      request('PUT', '/defaults', {
        trainId: id,
        allocations: [{ categoryId: id, defaultPct: 2.5 }],
      }),
    ),
    await allocations.PUT(
      request('PUT', '/allocations', {
        teamId: id,
        piId: id,
        overrides: [{ categoryId: id, overridePct: 2.5 }],
      }),
    ),
    await allocations.DELETE(request('DELETE', '/allocations?teamId=bad')),
  ])
    await expectError(response, 400);
  expect(getDbContext).not.toHaveBeenCalled();
  const unavailable = new FoundationError(
    'query',
    'Database unavailable.',
    'Restart Azusa.',
  );
  vi.mocked(getDbContext).mockRejectedValueOnce(unavailable);
  await expectError(await catalog.GET(request('GET', `?trainId=${id}`)), 503, [
    { stage: 'query', recoveryHint: 'Restart Azusa.' },
  ]);
  vi.mocked(getCachedDbError).mockReturnValue(unavailable);
  await expectError(
    await sample(request('POST', '/sample', { trainId: id })),
    503,
  );
  expect(getDbContext).toHaveBeenCalledTimes(1);
});

it('preserves business error precedence and returns exact allocation error details', async () => {
  const { trainId, pair, pairQuery } = await fixture();
  const unknown = crypto.randomUUID();
  const reorderIds = (orderedIds: string[]) =>
    reorder(
      request('POST', '/reorder', {
        trainId,
        kind: 'development',
        orderedIds,
      }),
    );
  await expectError(await reorderIds([]), 400);
  const { development, overhead } = await loadSample(trainId);
  const [first, second] = development;
  const overheadId = overhead[0]!.id;
  const withDefaults = (ids: string[], values: number[]) =>
    defaults(
      request('PUT', '/defaults', {
        trainId,
        allocations: ids.map((categoryId, index) => ({
          categoryId,
          defaultPct: values[index],
        })),
      }),
    );
  const put = (ids: string[], values: (number | null)[]) =>
    allocations.PUT(
      request('PUT', '/allocations', {
        ...pair,
        overrides: ids.map((categoryId, index) => ({
          categoryId,
          overridePct: values[index],
        })),
      }),
    );
  const ids = development.map(({ id }) => id);
  for (const response of [
    await catalog.GET(request('GET', `?trainId=${unknown}`)),
    await allocations.GET(
      request('GET', `/allocations?teamId=${unknown}&piId=${pair.piId}`),
    ),
    await allocations.GET(
      request('GET', `/allocations?teamId=${pair.teamId}&piId=${unknown}`),
    ),
    await category.DELETE(request('DELETE', `/${unknown}`), context(unknown)),
    await reorderIds([unknown]),
    await withDefaults([unknown], [100]),
    await put([unknown], [100]),
  ])
    await expectError(response, 404);
  for (const response of [
    await reorderIds([first!.id]),
    await withDefaults([first!.id], [100]),
    await put([first!.id], [100]),
    await category.PATCH(
      request('PATCH', `/${first!.id}`, { semanticRole: null }),
      context(first!.id),
    ),
  ])
    await expectError(response, 400);
  await expectError(await withDefaults(ids, [44, 20, 14, 10, 7]), 400, [
    { currentTotal: 95, requiredTotal: 100 },
  ]);
  await expectError(await put(ids, [44, null, null, null, null]), 400, [
    { currentTotal: 95, requiredTotal: 100 },
  ]);

  const duplicateName = { ...makeCategory(trainId), name: ' training ' };
  const duplicateRole = {
    ...makeCategory(trainId),
    kind: 'development',
    semanticRole: 'maintenance_bugs',
  };
  const foreign = await fixture();
  const foreignCategory = await json(
    await catalog.POST(
      request('POST', '', {
        ...makeCategory(foreign.trainId),
        kind: 'development',
        semanticRole: 'standard',
      }),
    ),
    201,
  );
  for (const response of [
    await catalog.POST(request('POST', '', duplicateName)),
    await catalog.POST(request('POST', '', duplicateRole)),
    await sample(request('POST', '/sample', { trainId })),
    await reorderIds([overheadId]),
    await withDefaults([overheadId], [100]),
    await put([overheadId], [100]),
    await put([foreignCategory.id], [100]),
    await allocations.GET(
      request(
        'GET',
        `/allocations?teamId=${pair.teamId}&piId=${foreign.pair.piId}`,
      ),
    ),
  ])
    await expectError(response, 409);
  await json(await put(ids, [56, 15, null, 8, null]), 200);
  for (const response of [
    await category.DELETE(
      request('DELETE', `/${first!.id}`),
      context(first!.id),
    ),
    await category.PATCH(
      request('PATCH', `/${first!.id}`, { kind: 'overhead' }),
      context(first!.id),
    ),
  ])
    await expectError(response, 409);
  await json(
    await category.PATCH(
      request('PATCH', `/${second!.id}`, { recordStatus: 'archived' }),
      context(second!.id),
    ),
    200,
  );
  for (const response of [
    await reorderIds([second!.id]),
    await withDefaults([second!.id], [100]),
    await put([second!.id], [100]),
  ])
    await expectError(response, 409);

  await db
    .update(teams)
    .set({ recordStatus: 'archived' })
    .where(eq(teams.id, pair.teamId));
  await expectError(
    await allocations.DELETE(request('DELETE', pairQuery)),
    409,
  );
  await expectError(await put([], []), 409);
  await db
    .update(teams)
    .set({ recordStatus: 'active' })
    .where(eq(teams.id, pair.teamId));
  await db
    .update(pis)
    .set({ recordStatus: 'archived' })
    .where(eq(pis.id, pair.piId));
  await expectError(
    await allocations.DELETE(request('DELETE', pairQuery)),
    409,
  );
  await expectError(await put([], []), 409);
  await db
    .update(pis)
    .set({ recordStatus: 'active' })
    .where(eq(pis.id, pair.piId));
  await db
    .update(trains)
    .set({ recordStatus: 'archived' })
    .where(eq(trains.id, trainId));
  await expectError(
    await allocations.DELETE(request('DELETE', pairQuery)),
    409,
  );
  await expectError(await put([], []), 409);
  await expectError(
    await catalog.POST(request('POST', '', makeCategory(trainId))),
    409,
  );
});
