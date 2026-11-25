import { z } from 'zod';
import { CATEGORY_KINDS, CATEGORY_SEMANTIC_ROLES } from './rules';

const uuid = z.uuidv4();
const label = z.string('Enter a value').trim().min(1, 'Enter a value');
const colorMessage = 'Enter a color such as #2F62C8';
const color = z.string(colorMessage).regex(/^#[0-9a-f]{6}$/i, colorMessage);
const percentageMessage = 'Enter a whole number from 0 to 100';
const percentage = z
  .number(percentageMessage)
  .int(percentageMessage)
  .min(0, percentageMessage)
  .max(100, percentageMessage);
const kind = z.enum(CATEGORY_KINDS);
const semanticRole = z.enum(CATEGORY_SEMANTIC_ROLES);
const metadata = { name: label, shortLabel: label, color };
const teamPi = { teamId: uuid, piId: uuid };

function uniqueIds(ids: readonly string[]) {
  return new Set(ids).size === ids.length;
}

export const ListCategoriesQuerySchema = z.strictObject({
  trainId: uuid,
  includeArchived: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});
export const TeamPiAllocationQuerySchema = z.strictObject(teamPi);

export const CreateCategorySchema = z.discriminatedUnion('kind', [
  z.strictObject({
    trainId: uuid,
    ...metadata,
    kind: z.literal('development'),
    semanticRole,
  }),
  z.strictObject({
    trainId: uuid,
    ...metadata,
    kind: z.literal('overhead'),
    semanticRole: z.null().optional(),
  }),
]);

export const UpdateCategorySchema = z
  .strictObject({
    ...metadata,
    kind,
    semanticRole: semanticRole.nullable(),
    recordStatus: z.enum(['active', 'archived']),
  })
  .partial();

export const ReorderCategoriesSchema = z.strictObject({
  trainId: uuid,
  kind,
  orderedIds: z
    .array(uuid)
    .min(1)
    .refine(uniqueIds, 'Category IDs must be unique'),
});
export const ApplySampleCatalogSchema = z.strictObject({ trainId: uuid });

export const SaveArtDefaultsSchema = z.strictObject({
  trainId: uuid,
  allocations: z
    .array(z.strictObject({ categoryId: uuid, defaultPct: percentage }))
    .refine(
      (entries) => uniqueIds(entries.map(({ categoryId }) => categoryId)),
      'Category IDs must be unique',
    ),
});

export const SaveTeamPiAllocationSchema = z.strictObject({
  ...teamPi,
  overrides: z
    .array(
      z.strictObject({ categoryId: uuid, overridePct: percentage.nullable() }),
    )
    .refine(
      (entries) => uniqueIds(entries.map(({ categoryId }) => categoryId)),
      'Category IDs must be unique',
    ),
});
