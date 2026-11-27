import { expect, it } from 'vitest';
import {
  contributesToDevCapacity,
  MEMBER_ROLES,
} from '../../src/domain/organization/roles';
import {
  getHolidaySeedYears,
  isEstimatedHolidayRule,
  resolveEffectiveLocationHolidays,
} from '../../src/domain/organization/holidays';
import {
  CreateAbsenceSchema,
  CreateHolidaySchema,
  CreateIterationSchema,
  CreateLocationSchema,
  CreateMemberSchema,
  CreateTeamSchema,
  IdPathSchema,
  ListLocationsQuerySchema,
  ListMembersQuerySchema,
  UpdateLocationSchema,
  UpdateMemberSchema,
} from '../../src/domain/organization/schemas';

const id = 'd94da9da-7b66-4e76-b6ea-ccfa34b80bad';
const team = { trainId: id, name: 'Team' };
const member = {
  teamId: id,
  locationId: id,
  fullName: 'Jane Lee',
  initials: 'JL',
  role: 'SM',
};
const location = {
  code: 'IN',
  name: 'India',
  countryCode: 'IN',
  subdivisionCode: 'KA',
  timeZone: 'Asia/Calcutta',
  calendarSource: 'India',
};

it('applies role and holiday rules', () => {
  expect(MEMBER_ROLES.map(contributesToDevCapacity)).toEqual([
    false,
    false,
    false,
    false,
    true,
  ]);
  expect(getHolidaySeedYears(2027)).toEqual([2026, 2027, 2028, 2029]);
  expect(getHolidaySeedYears(2032)).toEqual([
    2026, 2027, 2028, 2031, 2032, 2033, 2034,
  ]);
  expect(isEstimatedHolidayRule('1 Shawwal')).toBe(true);
  expect(isEstimatedHolidayRule('10 Dhu al-Hijjah')).toBe(true);
  expect(isEstimatedHolidayRule('chinese 01-0-01')).toBe(false);
  expect(isEstimatedHolidayRule()).toBe(false);
  const library = {
    locationId: id,
    date: '2027-01-01',
    source: 'library' as const,
  };
  const manual = { ...library, source: 'manual' as const };
  const company = { ...library, source: 'company' as const };
  const other = { ...library, locationId: 'other' };
  expect(
    resolveEffectiveLocationHolidays([library, manual, other, company]),
  ).toEqual([manual, other, company]);
});

it('parses strict payloads and rejects out-of-range or protected fields', () => {
  expect(CreateTeamSchema.parse(team).sprintOffsetWorkdays).toBe(0);
  expect(CreateMemberSchema.parse(member).fteFactor).toBe(1);
  for (const value of [-2, 2, 0.5, '1'])
    expect(
      CreateTeamSchema.safeParse({ ...team, sprintOffsetWorkdays: value })
        .success,
    ).toBe(false);
  for (const value of [0, 1.01])
    expect(
      CreateMemberSchema.safeParse({ ...member, fteFactor: value }).success,
    ).toBe(false);
  for (const field of ['actor', 'createdBy', 'updatedBy', 'extra'])
    expect(
      CreateTeamSchema.safeParse({ ...team, [field]: 'local' }).success,
    ).toBe(false);
  expect(
    UpdateMemberSchema.safeParse({ effectiveDate: '2027-01-04' }).success,
  ).toBe(false);
  expect(CreateLocationSchema.parse(location).timeZone).toBe('Asia/Kolkata');
  for (const value of ['Invalid/Zone', '+05:30'])
    expect(
      CreateLocationSchema.safeParse({ ...location, timeZone: value }).success,
    ).toBe(false);
  expect(UpdateLocationSchema.safeParse({ code: 'JP' }).success).toBe(false);
  expect(
    CreateAbsenceSchema.safeParse({ memberId: id, absenceTypeId: id }).success,
  ).toBe(false);
  expect(
    CreateAbsenceSchema.safeParse({
      memberId: id,
      absenceTypeId: id,
      date: '2027-02-29',
    }).success,
  ).toBe(false);
  expect(
    CreateIterationSchema.safeParse({
      name: 'Sprint',
      kind: 'development',
      startDate: '2027-01-09',
      endDate: '2027-01-15',
    }).success,
  ).toBe(false);
});

it('validates path and query parameters', () => {
  expect(IdPathSchema.safeParse({ id }).success).toBe(true);
  expect(IdPathSchema.safeParse({ id: 'bad' }).success).toBe(false);
  expect(
    ListMembersQuerySchema.parse({
      teamId: id,
      asOf: '2027-01-04',
      includeArchived: 'false',
    }),
  ).toMatchObject({ teamId: id, includeArchived: false });
  expect(
    ListMembersQuerySchema.safeParse({ teamId: 'bad', asOf: '2027-02-29' })
      .success,
  ).toBe(false);
  expect(ListLocationsQuerySchema.parse({ year: '2027' }).year).toBe(2027);
  for (const query of [
    { year: '2101' },
    { year: '2e3' },
    { includeArchived: 'yes' },
  ])
    expect(ListLocationsQuerySchema.safeParse(query).success).toBe(false);
});

it('stores canonical IANA zones and requires explicit holiday provenance', () => {
  expect(
    CreateLocationSchema.parse({ ...location, timeZone: 'asia/manila' })
      .timeZone,
  ).toBe('Asia/Manila');
  expect(
    CreateLocationSchema.safeParse({ ...location, timeZone: 'EST' }).success,
  ).toBe(false);
  const holiday = { locationId: id, date: '2027-01-01', name: 'Company day' };
  expect(CreateHolidaySchema.safeParse(holiday).success).toBe(false);
  expect(
    CreateHolidaySchema.parse({ ...holiday, source: 'company' }).source,
  ).toBe('company');
});
