import { z } from 'zod';

const id = z.uuidv4();
const velocity = z.number().min(0).max(1000);
const deductionMode = z.enum(['fixed_days', 'percent']);

export const CapacityViewQuerySchema = z.strictObject({ teamId: id, piId: id });
export const DeleteTeamPiVelocityOverrideQuerySchema = CapacityViewQuerySchema;
export const SetTeamPiVelocityOverrideSchema = CapacityViewQuerySchema.extend({
  velocity,
});

export const UpdateTeamCapacitySettingsSchema = z
  .strictObject({
    teamId: id,
    deductionMode: deductionMode.optional(),
    hoursPerDay: z.number().min(1).max(24).multipleOf(0.5).optional(),
    seedNormalizedVelocity: velocity.nullable().optional(),
  })
  .refine(
    ({ deductionMode, hoursPerDay, seedNormalizedVelocity }) =>
      deductionMode !== undefined ||
      hoursPerDay !== undefined ||
      seedNormalizedVelocity !== undefined,
    { message: 'Provide at least one capacity setting.' },
  );

export const BulkApplyOverheadDeductionsSchema = CapacityViewQuerySchema.extend(
  {
    mode: deductionMode,
    entries: z
      .array(z.strictObject({ categoryId: id, value: z.number().min(0) }))
      .min(1),
  },
).superRefine(({ mode, entries }, ctx) => {
  const max = mode === 'fixed_days' ? 31 : 100;
  const seen = new Set<string>();
  for (const [index, { categoryId, value }] of entries.entries()) {
    if (seen.has(categoryId)) {
      ctx.addIssue({
        code: 'custom',
        path: ['entries', index, 'categoryId'],
        message: 'Duplicate category.',
      });
    }
    seen.add(categoryId);
    if (value > max) {
      ctx.addIssue({
        code: 'custom',
        path: ['entries', index, 'value'],
        message: `Value must be at most ${max}.`,
      });
    }
  }
});

export const UpsertOverheadDeductionSchema = z.strictObject({
  teamId: id,
  memberId: id,
  iterationId: id,
  categoryId: id,
  deductedHours: z.number().min(0).max(744).multipleOf(0.25),
});
