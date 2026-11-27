import type { APIRequestContext } from '@playwright/test';
import { and, between, eq, inArray } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import {
  absenceTypes,
  absences,
  holidays,
  iterations,
  locations,
  members,
  memberTeamAssignments,
  pis,
  teams,
  trains,
} from '../../src/persistence/schema';
import { capacityGoldenFixture } from './capacity-golden-fixture';

const uuid = (n: number) =>
  `00ca0000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const capacityBrowserIds = {
  art: uuid(1),
  team: uuid(2),
  pi: uuid(3),
  cebu: uuid(4),
  emptyPi: uuid(5),
  otherArt: uuid(6),
  otherTeam: uuid(7),
  otherPi: uuid(8),
  archivedTeam: uuid(9),
};

// Calendar writes have no public HTTP surface; this runs on the isolated
// Playwright database before the server takes its lock.
export async function seedCapacityBrowserFixture(db: PgliteDatabase) {
  const ids = capacityBrowserIds;
  const fixture = capacityGoldenFixture();
  await db.transaction(async (tx) => {
    await tx.insert(trains).values([
      { id: ids.art, name: 'Payments ART', recordStatus: 'archived' },
      { id: ids.otherArt, name: 'Delivery ART', recordStatus: 'archived' },
    ]);
    await tx.insert(teams).values([
      { id: ids.team, trainId: ids.art, name: 'Palawan' },
      { id: ids.cebu, trainId: ids.art, name: 'Cebu' },
      {
        id: ids.archivedTeam,
        trainId: ids.art,
        name: 'Archived Palawan',
        recordStatus: 'archived',
      },
      { id: ids.otherTeam, trainId: ids.otherArt, name: 'Manila' },
    ]);
    await tx.insert(pis).values([
      { ...fixture.pi, id: ids.pi, trainId: ids.art },
      {
        id: ids.emptyPi,
        trainId: ids.art,
        name: 'PI-2027.2',
        startDate: '2027-04-05',
        endDate: '2027-06-04',
      },
      {
        ...fixture.pi,
        id: ids.otherPi,
        trainId: ids.otherArt,
        name: 'Delivery PI',
      },
    ]);
    await tx.insert(iterations).values(
      fixture.iterations.map((sprint, index) => ({
        ...sprint,
        id: uuid(10 + index),
        piId: ids.pi,
      })),
    );
    const locationIds = new Map(
      (await tx.select().from(locations)).map((location) => [
        location.code,
        location.id,
      ]),
    );
    const memberIds = new Map(
      fixture.members.map((member, index) => [
        member.memberId,
        uuid(20 + index),
      ]),
    );
    await tx.insert(members).values(
      fixture.members.map((member) => ({
        ...member,
        id: memberIds.get(member.memberId),
        locationId: locationIds.get(member.location.code)!,
        nickname: member.nickname ?? '',
        avatarColor: member.avatarColor ?? '#585c65',
      })),
    );
    await tx.insert(memberTeamAssignments).values(
      fixture.assignments.map((item) => ({
        ...item,
        memberId: memberIds.get(item.memberId)!,
        teamId: ids.team,
      })),
    );
    // Use the canonical calendar for this PI in the isolated test database.
    // Library estimates can move dates or introduce extra days off.
    const fixtureLocations = new Set(
      fixture.members.map(({ location }) => locationIds.get(location.code)!),
    );
    await tx
      .delete(holidays)
      .where(
        and(
          inArray(holidays.locationId, [...fixtureLocations]),
          between(holidays.date, fixture.pi.startDate, fixture.pi.endDate),
          eq(holidays.source, 'library'),
        ),
      );
    await tx.insert(holidays).values(
      fixture.holidays.map((holiday) => ({
        ...holiday,
        id: undefined,
        locationId: locationIds.get(holiday.locationId)!,
      })),
    );
    const typeIds = new Map(
      (await tx.select().from(absenceTypes)).map((type) => [
        type.code,
        type.id,
      ]),
    );
    await tx.insert(absences).values([
      ...fixture.absences.map((absence) => ({
        memberId: memberIds.get(absence.memberId)!,
        date: absence.date,
        portion: absence.portion,
        absenceTypeId: typeIds.get(
          absence.name === 'Sick leave' ? 'SL' : 'AL',
        )!,
        status: absence.status,
      })),
      {
        memberId: memberIds.get('carlo')!,
        date: '2027-03-10',
        portion: 'am',
        absenceTypeId: typeIds.get('HD')!,
      },
      {
        memberId: memberIds.get('carlo')!,
        date: '2027-03-11',
        status: 'cancelled',
        absenceTypeId: typeIds.get('AL')!,
      },
      {
        memberId: memberIds.get('carlo')!,
        date: '2027-03-12',
        absenceTypeId: typeIds.get('BT')!,
      },
    ]);
  });
}

export async function setCapacityFixtureActive(
  request: APIRequestContext,
  active: boolean,
) {
  for (const id of [capacityBrowserIds.art, capacityBrowserIds.otherArt]) {
    const response = await request.patch(`/api/organization/trains/${id}`, {
      data: { recordStatus: active ? 'active' : 'archived' },
    });
    if (!response.ok()) throw new Error(await response.text());
  }
}

export async function prepareCapacityCatalog(request: APIRequestContext) {
  const { art, team, pi } = capacityBrowserIds;
  const sample = await request.post('/api/categories/sample', {
    data: { trainId: art },
  });
  if (!sample.ok()) throw new Error(await sample.text());
  const {
    categories,
  }: {
    categories: { id: string; kind: string; name: string; sortOrder: number }[];
  } = await sample.json();
  const development = categories
    .filter((category) => category.kind === 'development')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const allocations = await request.put('/api/categories/allocations', {
    data: {
      teamId: team,
      piId: pi,
      overrides: development.map((category, index) => ({
        categoryId: category.id,
        overridePct: [56, 15, null, 8, null][index],
      })),
    },
  });
  if (!allocations.ok()) throw new Error(await allocations.text());
  return {
    gw: categories.find(({ name }) => name === 'General work')!.id,
    training: categories.find(({ name }) => name === 'Training')!.id,
    development: development[0]!.id,
  };
}
