import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import {
  FoundationError,
  getCachedDbError,
  getDbContext,
} from '../../src/persistence/client';
import { GET as context } from '../../src/app/api/organization/context/route';
import * as trains from '../../src/app/api/organization/trains/route';
import * as train from '../../src/app/api/organization/trains/[id]/route';
import * as teams from '../../src/app/api/organization/teams/route';
import * as team from '../../src/app/api/organization/teams/[id]/route';
import * as members from '../../src/app/api/organization/members/route';
import * as member from '../../src/app/api/organization/members/[id]/route';
import * as pending from '../../src/app/api/organization/members/[id]/pending-move/route';
import * as pis from '../../src/app/api/organization/pis/route';
import * as pi from '../../src/app/api/organization/pis/[id]/route';
import * as iterations from '../../src/app/api/organization/pis/[id]/iterations/route';
import * as iteration from '../../src/app/api/organization/iterations/[id]/route';
import * as locations from '../../src/app/api/organization/locations/route';
import * as location from '../../src/app/api/organization/locations/[id]/route';
import * as holidays from '../../src/app/api/organization/locations/[id]/holidays/route';
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
afterAll(async () => {
  await client?.close();
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getDbContext).mockImplementation(async () => ({
    client,
    db,
    dbDir: '',
    backupDir: '',
    migrationsFolder: '',
    release: async () => {},
    startupBackup: { trigger: 'skipped_cold_start' },
  }));
});

function request(method: string, path: string, body?: unknown) {
  return new Request(`http://127.0.0.1/api/organization/${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
const route = (id: string) => ({ params: Promise.resolve({ id }) });

async function json(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get('cache-control')).toBe('no-store');
  return response.json();
}

it('validates input before acquiring the DB and maps a cached FoundationError to 503', async () => {
  for (const response of [
    await trains.POST(
      new Request('http://127.0.0.1', { method: 'POST', body: '{' }),
    ),
    await trains.POST(
      request('POST', 'trains', { name: 'Invalid', actor: 'spoofed' }),
    ),
    await trains.GET(
      request('GET', 'trains?includeArchived=true&includeArchived=false'),
    ),
    await teams.GET(request('GET', 'teams?trainId=invalid')),
    await members.GET(request('GET', 'members?asOf=2027-02-29')),
    await locations.GET(request('GET', 'locations?year=2101')),
    await context(request('GET', 'context?unexpected=1')),
    await train.PATCH(
      request('PATCH', 'trains/bad', { name: 'Invalid' }),
      route('bad'),
    ),
    await iterations.GET(
      request('GET', 'pis/id/iterations?teamId=bad'),
      route(crypto.randomUUID()),
    ),
  ]) {
    expect(await json(response, 400)).toMatchObject({
      error: {
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        details: expect.any(Array),
      },
    });
  }
  expect(getDbContext).not.toHaveBeenCalled();

  const unavailable = new FoundationError(
    'query',
    'Database unavailable.',
    'Restart Azusa.',
  );
  vi.mocked(getDbContext).mockRejectedValueOnce(unavailable);
  expect(
    await json(await context(request('GET', 'context')), 503),
  ).toMatchObject({ error: { code: 'DB_UNAVAILABLE' } });
  vi.mocked(getCachedDbError).mockReturnValue(unavailable);
  expect(
    await json(await context(request('GET', 'context')), 503),
  ).toMatchObject({ error: { code: 'DB_UNAVAILABLE' } });
});

it('routes organization CRUD, dated roster changes, cadence and read-only holidays', async () => {
  const a = await json(
    await trains.POST(request('POST', 'trains', { name: 'ART A' })),
    201,
  );
  const b = await json(
    await trains.POST(request('POST', 'trains', { name: 'ART B' })),
    201,
  );
  expect(
    await json(
      await train.PATCH(
        request('PATCH', 'trains/id', { name: 'Edited ART' }),
        route(a.id),
      ),
      200,
    ),
  ).toMatchObject({ name: 'Edited ART' });
  const one = await json(
    await teams.POST(
      request('POST', 'teams', { name: 'Team A', trainId: a.id }),
    ),
    201,
  );
  const two = await json(
    await teams.POST(
      request('POST', 'teams', { name: 'Team B', trainId: b.id }),
    ),
    201,
  );
  await json(
    await team.PATCH(
      request('PATCH', 'teams/id', { sprintOffsetWorkdays: -1 }),
      route(one.id),
    ),
    200,
  );
  expect(
    await json(await teams.GET(request('GET', `teams?trainId=${a.id}`)), 200),
  ).toMatchObject([{ id: one.id }]);
  expect(
    await json(
      await train.DELETE(request('DELETE', 'trains/id'), route(a.id)),
      409,
    ),
  ).toMatchObject({ error: { code: 'CONFLICT' } });
  expect(
    await json(await trains.GET(request('GET', 'trains')), 200),
  ).toHaveLength(2);

  const site = await json(
    await locations.POST(
      request('POST', 'locations', {
        code: 'JP',
        name: 'Japan',
        countryCode: 'JP',
        timeZone: 'Asia/Tokyo',
        calendarSource: 'Japan',
      }),
    ),
    201,
  );
  await json(
    await location.PATCH(
      request('PATCH', 'locations/id', { name: 'Japan Office' }),
      route(site.id),
    ),
    200,
  );
  expect(
    await json(await locations.GET(request('GET', 'locations?year=2027')), 200),
  ).toMatchObject([{ id: site.id }]);
  expect(
    await json(
      await holidays.GET(
        request('GET', 'locations/id/holidays?year=2027'),
        route(site.id),
      ),
      200,
    ),
  ).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ date: '2027-01-01', effective: true }),
    ]),
  );
  await json(
    await location.DELETE(request('DELETE', 'locations/id'), route(site.id)),
    409,
  );
  const person = await json(
    await members.POST(
      request('POST', 'members', {
        teamId: one.id,
        locationId: site.id,
        fullName: 'Sample Person',
        initials: 'SP',
        role: 'PO',
      }),
    ),
    201,
  );
  const effectiveDate = '2026-11-25';
  expect(
    await json(
      await member.PATCH(
        request('PATCH', 'members/id', { fteFactor: 1.5 }),
        route(person.id),
      ),
      400,
    ),
  ).toMatchObject({
    error: {
      code: 'VALIDATION_ERROR',
      details: [{ path: ['fteFactor'], message: 'FTE must be 1 or less' }],
    },
  });
  await json(
    await member.PATCH(
      request('PATCH', 'members/id', { teamId: two.id, effectiveDate }),
      route(person.id),
    ),
    200,
  );
  expect(
    await json(
      await members.GET(
        request('GET', `members?teamId=${two.id}&asOf=${effectiveDate}`),
      ),
      200,
    ),
  ).toMatchObject([{ id: person.id, teamId: two.id }]);
  expect(
    await json(
      await pending.DELETE(
        request('DELETE', 'members/id/pending-move'),
        route(person.id),
      ),
      200,
    ),
  ).toMatchObject({ teamId: one.id, pendingMove: null });
  await json(
    await pending.DELETE(
      request('DELETE', 'members/id/pending-move'),
      route(person.id),
    ),
    404,
  );
  await json(
    await member.DELETE(request('DELETE', 'members/id'), route(person.id)),
    200,
  );

  const increment = await json(
    await pis.POST(
      request('POST', 'pis', {
        trainId: a.id,
        name: 'PI',
        startDate: '2027-01-04',
        endDate: '2027-01-29',
      }),
    ),
    201,
  );
  await json(
    await pi.PATCH(
      request('PATCH', 'pis/id', { name: 'PI Edited' }),
      route(increment.id),
    ),
    200,
  );
  const sprint = await json(
    await iterations.POST(
      request('POST', 'pis/id/iterations', {
        name: 'Sprint 1',
        kind: 'development',
        startDate: '2027-01-04',
        endDate: '2027-01-15',
      }),
      route(increment.id),
    ),
    201,
  );
  await json(
    await iteration.PATCH(
      request('PATCH', 'iterations/id', { name: 'Renamed' }),
      route(sprint.id),
    ),
    200,
  );
  expect(
    await json(await pis.GET(request('GET', `pis?trainId=${a.id}`)), 200),
  ).toMatchObject([
    { id: increment.id, iterations: [{ id: sprint.id, name: 'Renamed' }] },
  ]);
  expect(
    await json(
      await iterations.GET(
        request('GET', `pis/id/iterations?teamId=${one.id}`),
        route(increment.id),
      ),
      200,
    ),
  ).toMatchObject([{ teamSchedule: { scheduledStartDate: '2027-01-01' } }]);
  await json(
    await iterations.GET(
      request('GET', `pis/id/iterations?teamId=${two.id}`),
      route(increment.id),
    ),
    409,
  );
  await json(
    await iterations.GET(
      request('GET', `pis/id/iterations?teamId=${crypto.randomUUID()}`),
      route(increment.id),
    ),
    404,
  );
  await json(
    await iterations.GET(
      request('GET', 'pis/id/iterations'),
      route(crypto.randomUUID()),
    ),
    404,
  );
  expect(
    await json(await context(request('GET', 'context')), 200),
  ).toMatchObject({
    trains: expect.arrayContaining([
      expect.objectContaining({
        id: a.id,
        teams: [expect.objectContaining({ id: one.id })],
      }),
    ]),
  });
  await json(
    await iteration.DELETE(
      request('DELETE', 'iterations/id'),
      route(sprint.id),
    ),
    200,
  );
  await json(
    await pi.DELETE(request('DELETE', 'pis/id'), route(increment.id)),
    200,
  );
  await json(
    await team.DELETE(request('DELETE', 'teams/id'), route(one.id)),
    200,
  );
  await json(
    await train.DELETE(request('DELETE', 'trains/id'), route(a.id)),
    200,
  );
});
