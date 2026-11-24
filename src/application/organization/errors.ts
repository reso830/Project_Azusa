import type { PgliteDatabase } from 'drizzle-orm/pglite';
import type { ZodType } from 'zod';

export class OrganizationError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    readonly code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT',
    message: string,
    readonly details: readonly unknown[] = [],
  ) {
    super(message);
    this.name = new.target.name;
  }

  toJSON() {
    return { code: this.code, message: this.message, details: this.details };
  }
}

export class ValidationError extends OrganizationError {
  constructor(message: string, details?: readonly unknown[]) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class NotFoundError extends OrganizationError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends OrganizationError {
  constructor(message: string, details?: readonly unknown[]) {
    super(409, 'CONFLICT', message, details);
  }
}

export function validate<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError(
      'Invalid organization data.',
      result.error.issues.map(({ path, message }) => ({ path, message })),
    );
  }
  return result.data;
}

export function requireRecord<T>(rows: readonly T[], entity: string): T {
  const row = rows[0];
  if (row === undefined) throw new NotFoundError(`${entity} was not found.`);
  return row;
}

export function requireActive(
  record: { recordStatus: string },
  entity: string,
) {
  if (record.recordStatus !== 'active')
    throw new ConflictError(`${entity} is archived.`);
}

export type OrganizationOptions = { today?: string; actor?: string };
export type OrganizationTransaction = Parameters<
  Parameters<PgliteDatabase['transaction']>[0]
>[0];

export async function writeOrganization<T>(
  db: PgliteDatabase,
  write: (tx: OrganizationTransaction) => Promise<T>,
  conflictMessage = 'A related record prevents this change.',
): Promise<T> {
  try {
    return await db.transaction(write);
  } catch (error) {
    for (let cause = error; cause instanceof Error; cause = cause.cause) {
      if (
        'code' in cause &&
        (cause.code === '23505' ||
          cause.code === '23503' ||
          cause.code === '23001')
      ) {
        throw new ConflictError(conflictMessage);
      }
    }
    throw error;
  }
}
