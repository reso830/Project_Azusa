import { z } from 'zod';
import { normalizeTimeZone } from '../calendar/iso-week';
import { isWeekday } from './cadence';
import { MEMBER_ROLES } from './roles';

const uuid = z.uuidv4();
const date = z.iso.date('Enter a valid date in YYYY-MM-DD format');
const weekday = date.refine(
  isWeekday,
  'Sprint dates must fall Monday through Friday',
);
const name = z.string('Enter a value').trim().min(1, 'Enter a value');
const color = z
  .string()
  .regex(/^#[0-9a-f]{6}$/i, 'Enter a color such as #2F62C8');
const recordStatus = z.enum(['active', 'archived']);
const offset = z.union(
  [z.literal(-1), z.literal(0), z.literal(1)],
  'Choose a Sprint offset of −1, 0, or +1 working day',
);
const absenceStatus = z.enum(['active', 'cancelled']);

const timeZone = name.transform((zone, context) => {
  if (zone.includes('/') || /^utc$/i.test(zone)) {
    try {
      const canonical = new Intl.DateTimeFormat('en-US', {
        timeZone: zone,
      }).resolvedOptions().timeZone;
      return normalizeTimeZone(canonical);
    } catch {
      // Intl rejects unknown named zones.
    }
  }
  context.addIssue({
    code: 'custom',
    message: 'Expected an IANA time zone (Area/Location or UTC)',
  });
  return z.NEVER;
});

const includeArchived = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')
  .optional();
const year = z
  .string()
  .regex(/^\d{4}$/)
  .transform(Number)
  .pipe(z.number().int().min(1970).max(2100))
  .optional();

export const IdPathSchema = z.strictObject({ id: uuid });
export const ListTrainsQuerySchema = z.strictObject({ includeArchived });
export const ListTeamsQuerySchema = z.strictObject({
  includeArchived,
  trainId: uuid.optional(),
});
export const ListPisQuerySchema = ListTeamsQuerySchema;
export const ListMembersQuerySchema = z.strictObject({
  includeArchived,
  teamId: uuid.optional(),
  asOf: date.optional(),
});
export const ListIterationsQuerySchema = z.strictObject({
  teamId: uuid.optional(),
});
export const ListLocationsQuerySchema = z.strictObject({
  includeArchived,
  year,
});
export const ListHolidaysQuerySchema = z.strictObject({ year });

export const CreateTrainSchema = z.strictObject({ name });
export const UpdateTrainSchema = z.strictObject({
  name: name.optional(),
  recordStatus: recordStatus.optional(),
});

const teamFields = { name, sprintOffsetWorkdays: offset };
export const CreateTeamSchema = z.strictObject({
  ...teamFields,
  trainId: uuid,
  sprintOffsetWorkdays: offset.default(0),
});
export const UpdateTeamSchema = z
  .strictObject({ ...teamFields, recordStatus })
  .partial();

const memberFields = {
  teamId: uuid,
  locationId: uuid,
  fullName: name,
  nickname: z.string().trim(),
  initials: name.max(4, 'Initials must be 4 characters or fewer'),
  role: z.enum(MEMBER_ROLES),
  fteFactor: z
    .number('Enter a number for FTE')
    .gt(0, 'FTE must be greater than 0')
    .max(1, 'FTE must be 1 or less'),
  avatarColor: color,
};
export const CreateMemberSchema = z.strictObject({
  ...memberFields,
  nickname: memberFields.nickname.default(''),
  fteFactor: memberFields.fteFactor.default(1),
  avatarColor: color.default('#2F62C8'),
});
export const UpdateMemberSchema = z
  .strictObject({ ...memberFields, effectiveDate: date, recordStatus })
  .partial()
  .refine(
    (input) => input.effectiveDate === undefined || input.teamId !== undefined,
    {
      path: ['effectiveDate'],
      message: 'An effective date requires a destination Team',
    },
  );

function datesInOrder(input: {
  startDate?: string;
  endDate?: string;
}): boolean {
  return (
    input.startDate === undefined ||
    input.endDate === undefined ||
    input.startDate <= input.endDate
  );
}

const dateRangeMessage = {
  path: ['endDate'],
  message: 'End date must be on or after start date',
};
const piFields = { name, startDate: date, endDate: date };
export const CreatePiSchema = z
  .strictObject({ ...piFields, trainId: uuid })
  .refine(datesInOrder, dateRangeMessage);
export const UpdatePiSchema = z
  .strictObject({ ...piFields, recordStatus })
  .partial()
  .refine(datesInOrder, dateRangeMessage);

const iterationFields = {
  name,
  kind: z.enum(['development', 'ip']),
  startDate: weekday,
  endDate: weekday,
};
export const CreateIterationSchema = z
  .strictObject(iterationFields)
  .refine(datesInOrder, dateRangeMessage);
export const UpdateIterationSchema = z
  .strictObject(iterationFields)
  .partial()
  .refine(datesInOrder, dateRangeMessage);

const locationFields = {
  name,
  countryCode: z
    .string()
    .regex(/^[A-Z]{2}$/, 'Enter a two-letter country code such as PH'),
  subdivisionCode: z
    .string()
    .regex(/^[A-Z0-9]{1,3}$/, 'Enter a subdivision code such as WA or KA')
    .nullable(),
  timeZone,
  calendarSource: name,
};
export const CreateLocationSchema = z.strictObject({
  ...locationFields,
  code: name,
  subdivisionCode: locationFields.subdivisionCode.optional(),
});
export const UpdateLocationSchema = z
  .strictObject({ ...locationFields, recordStatus })
  .partial();

const holidayFields = {
  name,
  date,
  portion: z.enum(['full', 'half']),
  source: z.enum(['company', 'manual']),
  confirmed: z.boolean(),
};
export const CreateHolidaySchema = z.strictObject({
  ...holidayFields,
  locationId: uuid,
  portion: holidayFields.portion.default('full'),
  confirmed: holidayFields.confirmed.default(true),
});

export const CreateAbsenceTypeSchema = z.strictObject({
  code: name,
  name,
  color,
  affectsCapacity: z.boolean(),
});

const absencePortion = z.enum(['full', 'am', 'pm']);
export const CreateAbsenceSchema = z.strictObject({
  memberId: uuid,
  absenceTypeId: uuid,
  date,
  portion: absencePortion.default('full'),
  planned: z.boolean().default(true),
  status: absenceStatus.default('active'),
  extraHours: z.number().nonnegative().nullish(),
  note: z.string().nullish(),
});
export const UpdateAbsenceStatusSchema = z.strictObject({
  status: absenceStatus,
});
