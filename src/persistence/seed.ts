import Holidays from 'date-holidays';
import { and, eq, gte } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { resolveActor } from '../domain/audit/actor';
import { getServerTodayIsoDate } from '../domain/calendar/iso-week';
import {
  getHolidaySeedYears,
  isEstimatedHolidayRule,
} from '../domain/organization/holidays';
import { defaultLocations } from '../domain/organization/default-locations';
import { absenceTypes, holidays, locations } from './schema';

type SeedOptions = { actor?: string; today?: string };
type HolidayWriter = Pick<PgliteDatabase, 'insert' | 'update' | 'delete'>;
type Location = typeof locations.$inferSelect;

const initialAbsenceTypes = [
  { code: 'AL', name: 'Annual leave', color: '#4A7FD4', affectsCapacity: true },
  { code: 'SL', name: 'Sick leave', color: '#CC5A7A', affectsCapacity: true },
  { code: 'HD', name: 'Half day', color: '#A8C3EE', affectsCapacity: true },
  {
    code: 'BT',
    name: 'Business trip',
    color: '#E5E9F0',
    affectsCapacity: false,
  },
  {
    code: 'WFH',
    name: 'Work from home',
    color: '#DCE8DF',
    affectsCapacity: false,
  },
  {
    code: 'ON_SITE',
    name: 'On-site',
    color: '#EAE6DF',
    affectsCapacity: false,
  },
] satisfies (typeof absenceTypes.$inferInsert)[];

export function supportsHolidaySubdivision(
  countryCode: string,
  subdivisionCode: string,
): boolean {
  return Object.hasOwn(
    new Holidays().getStates(countryCode) ?? {},
    subdivisionCode,
  );
}

async function insertLibraryHolidays(
  db: HolidayWriter,
  location: Location,
  years: readonly number[],
  actor: string,
) {
  const calendar = location.subdivisionCode
    ? new Holidays(location.countryCode, location.subdivisionCode)
    : new Holidays(location.countryCode);
  const rows = years.flatMap((year) =>
    calendar.getHolidays(year).flatMap((holiday) => {
      if (holiday.type !== 'public' && holiday.type !== 'bank') return [];
      const date = holiday.date.slice(0, 10);
      if (
        location.librarySeedCutoffDate &&
        date < location.librarySeedCutoffDate
      )
        return [];
      return [
        {
          locationId: location.id,
          date,
          name: holiday.name,
          source: 'library' as const,
          confirmed: !isEstimatedHolidayRule(holiday.rule),
          createdBy: actor,
          updatedBy: actor,
        },
      ];
    }),
  );
  if (rows.length) await db.insert(holidays).values(rows).onConflictDoNothing();
}

// Use the caller's transaction so the rows and seed tracking are committed together.
export async function seedLocationHolidays(
  db: HolidayWriter,
  location: Location,
  years: readonly number[],
  options: SeedOptions = {},
) {
  const missingYears = years.filter(
    (year) => !location.seededYears.includes(year),
  );
  if (!missingYears.length) return;

  const actor = resolveActor(options.actor);
  await insertLibraryHolidays(db, location, missingYears, actor);
  const seededYears = [
    ...new Set([...location.seededYears, ...missingYears]),
  ].sort((a, b) => a - b);
  await db
    .update(locations)
    .set({ seededYears, lastRefreshedAt: new Date(), updatedBy: actor })
    .where(eq(locations.id, location.id));
}

// Run within the same transaction as the jurisdiction edit.
export async function reseedFutureLocationHolidays(
  db: HolidayWriter,
  location: Location,
  todayIsoDate: string,
  years: readonly number[],
  options: SeedOptions = {},
) {
  const actor = resolveActor(options.actor);
  await db
    .delete(holidays)
    .where(
      and(
        eq(holidays.locationId, location.id),
        eq(holidays.source, 'library'),
        gte(holidays.date, todayIsoDate),
      ),
    );
  await insertLibraryHolidays(
    db,
    { ...location, librarySeedCutoffDate: todayIsoDate },
    years,
    actor,
  );
  await db
    .update(locations)
    .set({
      librarySeedCutoffDate: todayIsoDate,
      seededYears: [...new Set(years)].sort((a, b) => a - b),
      lastRefreshedAt: new Date(),
      updatedBy: actor,
    })
    .where(eq(locations.id, location.id));
}

export async function seedReferenceData(
  db: PgliteDatabase,
  options: SeedOptions = {},
) {
  const today = options.today ?? getServerTodayIsoDate();
  const years = getHolidaySeedYears(Number(today.slice(0, 4)));
  const actor = resolveActor(options.actor);
  await db.transaction(async (tx) => {
    const hasKarnatakaCalendar =
      supportsHolidaySubdivision('IN', 'KA') &&
      new Holidays('IN', 'KA').getHolidays(Number(today.slice(0, 4))).length >
        0;
    await tx
      .insert(locations)
      .values(
        defaultLocations.map((location) => ({
          ...(location.code === 'IN' && !hasKarnatakaCalendar
            ? {
                ...location,
                subdivisionCode: null,
                calendarSource: 'Public holidays, IN',
              }
            : location),
          createdBy: actor,
          updatedBy: actor,
        })),
      )
      .onConflictDoNothing();
    await tx
      .insert(absenceTypes)
      .values(
        initialAbsenceTypes.map((absenceType) => ({
          ...absenceType,
          createdBy: actor,
          updatedBy: actor,
        })),
      )
      .onConflictDoNothing();
    for (const location of await tx.select().from(locations)) {
      await seedLocationHolidays(tx, location, years, { actor });
    }
  });
}
