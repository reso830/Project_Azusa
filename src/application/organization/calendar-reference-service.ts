import { and, asc, eq, gte, inArray, lt, ne, or } from 'drizzle-orm';
import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { resolveActor } from '../../domain/audit/actor';
import { getServerTodayIsoDate } from '../../domain/calendar/iso-week';
import {
  getHolidaySeedYears,
  resolveEffectiveLocationHolidays,
} from '../../domain/organization/holidays';
import {
  CreateAbsenceSchema,
  CreateHolidaySchema,
  CreateLocationSchema,
  IdPathSchema,
  UpdateAbsenceStatusSchema,
  UpdateLocationSchema,
} from '../../domain/organization/schemas';
import {
  absences,
  absenceTypes,
  holidays,
  locations,
  members,
} from '../../persistence/schema';
import {
  reseedFutureLocationHolidays,
  seedLocationHolidays,
  supportsHolidaySubdivision,
} from '../../persistence/seed';
import {
  ConflictError,
  type OrganizationOptions,
  requireActive,
  requireRecord,
  validate,
  ValidationError,
  writeOrganization,
} from './errors';

type Absence = typeof absences.$inferSelect;

function validateSubdivision(
  countryCode: string,
  subdivisionCode?: string | null,
) {
  if (
    subdivisionCode &&
    !supportsHolidaySubdivision(countryCode, subdivisionCode)
  ) {
    const message = `Subdivision ${subdivisionCode} has no supported holiday calendar for ${countryCode}. Clear it to use the country calendar.`;
    throw new ValidationError(message, [
      { path: ['subdivisionCode'], message },
    ]);
  }
}

function holidayYear(year?: number) {
  return year === undefined
    ? undefined
    : and(
        gte(holidays.date, `${year}-01-01`),
        lt(holidays.date, `${year + 1}-01-01`),
      );
}

async function getLocation(db: PgliteDatabase, id: string) {
  return requireRecord(
    await db.select().from(locations).where(eq(locations.id, id)),
    'Location',
  );
}

export async function listLocations(
  db: PgliteDatabase,
  {
    year,
    includeArchived = false,
  }: { year?: number; includeArchived?: boolean } = {},
) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        location: locations,
        memberCount: tx.$count(members, eq(members.locationId, locations.id)),
      })
      .from(locations)
      .where(includeArchived ? undefined : eq(locations.recordStatus, 'active'))
      .orderBy(asc(locations.code), asc(locations.id));
    if (!rows.length) return [];
    const holidayRows = await tx
      .select({
        id: holidays.id,
        date: holidays.date,
        source: holidays.source,
        locationId: holidays.locationId,
      })
      .from(holidays)
      .where(
        and(
          inArray(
            holidays.locationId,
            rows.map((row) => row.location.id),
          ),
          holidayYear(year),
        ),
      );
    const counts = new Map<string, number>();
    for (const holiday of resolveEffectiveLocationHolidays(holidayRows)) {
      counts.set(holiday.locationId, (counts.get(holiday.locationId) ?? 0) + 1);
    }
    return rows.map(({ location, memberCount }) => ({
      ...location,
      memberCount,
      holidayCount: counts.get(location.id) ?? 0,
    }));
  });
}

export async function createLocation(
  db: PgliteDatabase,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const data = validate(CreateLocationSchema, input);
  validateSubdivision(data.countryCode, data.subdivisionCode);
  const today = options.today ?? getServerTodayIsoDate();
  const actor = resolveActor(options.actor);
  return writeOrganization(
    db,
    async (tx) => {
      const location = requireRecord(
        await tx
          .insert(locations)
          .values({ ...data, createdBy: actor, updatedBy: actor })
          .returning(),
        'Location',
      );
      await seedLocationHolidays(
        tx,
        location,
        getHolidaySeedYears(Number(today.slice(0, 4))),
        { actor },
      );
      return getLocation(tx, location.id);
    },
    'A Location with this code already exists.',
  );
}

export async function updateLocation(
  db: PgliteDatabase,
  locationId: string,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const { id } = validate(IdPathSchema, { id: locationId });
  const data = validate(UpdateLocationSchema, input);
  const today = options.today ?? getServerTodayIsoDate();
  const actor = resolveActor(options.actor);
  return writeOrganization(db, async (tx) => {
    const before = await getLocation(tx, id);
    const countryCode = data.countryCode ?? before.countryCode;
    const subdivisionCode =
      data.subdivisionCode === undefined
        ? before.subdivisionCode
        : data.subdivisionCode;
    if (
      countryCode !== before.countryCode ||
      subdivisionCode !== before.subdivisionCode
    ) {
      validateSubdivision(countryCode, subdivisionCode);
    }
    const location = requireRecord(
      await tx
        .update(locations)
        .set({ ...data, updatedBy: actor })
        .where(eq(locations.id, id))
        .returning(),
      'Location',
    );
    if (
      location.countryCode !== before.countryCode ||
      location.subdivisionCode !== before.subdivisionCode
    ) {
      await reseedFutureLocationHolidays(
        tx,
        location,
        today,
        getHolidaySeedYears(Number(today.slice(0, 4))),
        { actor },
      );
      return getLocation(tx, id);
    }
    return location;
  });
}

export async function deleteLocation(db: PgliteDatabase, locationId: string) {
  const { id } = validate(IdPathSchema, { id: locationId });
  return writeOrganization(
    db,
    async (tx) =>
      requireRecord(
        await tx.delete(locations).where(eq(locations.id, id)).returning(),
        'Location',
      ),
    'This Location is referenced by Members or Holidays.',
  );
}

export async function listLocationHolidays(
  db: PgliteDatabase,
  locationId: string,
  { year }: { year?: number } = {},
) {
  const { id } = validate(IdPathSchema, { id: locationId });
  return db.transaction(async (tx) => {
    await getLocation(tx, id);
    const rows = await tx
      .select()
      .from(holidays)
      .where(and(eq(holidays.locationId, id), holidayYear(year)))
      .orderBy(asc(holidays.date), asc(holidays.name), asc(holidays.id));
    const effectiveIds = new Set(
      resolveEffectiveLocationHolidays(rows).map((row) => row.id),
    );
    return rows.map((row) => ({ ...row, effective: effectiveIds.has(row.id) }));
  });
}

export async function createHoliday(
  db: PgliteDatabase,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const data = validate(CreateHolidaySchema, input);
  const actor = resolveActor(options.actor);
  return writeOrganization(db, async (tx) => {
    requireActive(await getLocation(tx, data.locationId), 'Location');
    return requireRecord(
      await tx
        .insert(holidays)
        .values({ ...data, createdBy: actor, updatedBy: actor })
        .returning(),
      'Holiday',
    );
  });
}

export function listAbsenceTypes(db: PgliteDatabase) {
  return db.select().from(absenceTypes).orderBy(asc(absenceTypes.code));
}

async function checkAbsenceConflict(
  db: PgliteDatabase,
  candidate: Pick<
    Absence,
    'memberId' | 'absenceTypeId' | 'date' | 'portion' | 'status'
  > & { id?: string },
) {
  const type = requireRecord(
    await db
      .select()
      .from(absenceTypes)
      .where(eq(absenceTypes.id, candidate.absenceTypeId)),
    'AbsenceType',
  );
  if (!type.affectsCapacity || candidate.status !== 'active') return;

  const [conflict] = await db
    .select({ id: absences.id })
    .from(absences)
    .innerJoin(absenceTypes, eq(absenceTypes.id, absences.absenceTypeId))
    .where(
      and(
        eq(absences.memberId, candidate.memberId),
        eq(absences.date, candidate.date),
        eq(absences.status, 'active'),
        eq(absenceTypes.affectsCapacity, true),
        candidate.id ? ne(absences.id, candidate.id) : undefined,
        candidate.portion === 'full'
          ? undefined
          : or(
              eq(absences.portion, 'full'),
              eq(absences.portion, candidate.portion),
            ),
      ),
    )
    .limit(1);
  if (conflict)
    throw new ConflictError(
      'An active capacity-reducing Absence already covers this time.',
      [conflict],
    );
}

export async function createAbsence(
  db: PgliteDatabase,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const data = validate(CreateAbsenceSchema, input);
  const actor = resolveActor(options.actor);
  return writeOrganization(db, async (tx) => {
    requireRecord(
      await tx.select().from(members).where(eq(members.id, data.memberId)),
      'Member',
    );
    await checkAbsenceConflict(tx, data);
    return requireRecord(
      await tx
        .insert(absences)
        .values({ ...data, createdBy: actor, updatedBy: actor })
        .returning(),
      'Absence',
    );
  });
}

export async function listMemberAbsences(db: PgliteDatabase, memberId: string) {
  const { id } = validate(IdPathSchema, { id: memberId });
  return db.transaction(async (tx) => {
    requireRecord(
      await tx.select().from(members).where(eq(members.id, id)),
      'Member',
    );
    return tx
      .select()
      .from(absences)
      .where(eq(absences.memberId, id))
      .orderBy(asc(absences.date), asc(absences.id));
  });
}

export async function updateAbsenceStatus(
  db: PgliteDatabase,
  absenceId: string,
  input: unknown,
  options: OrganizationOptions = {},
) {
  const { id } = validate(IdPathSchema, { id: absenceId });
  const { status } = validate(UpdateAbsenceStatusSchema, input);
  return writeOrganization(db, async (tx) => {
    const absence = requireRecord(
      await tx.select().from(absences).where(eq(absences.id, id)),
      'Absence',
    );
    await checkAbsenceConflict(tx, { ...absence, status });
    return requireRecord(
      await tx
        .update(absences)
        .set({ status, updatedBy: resolveActor(options.actor) })
        .where(eq(absences.id, id))
        .returning(),
      'Absence',
    );
  });
}
