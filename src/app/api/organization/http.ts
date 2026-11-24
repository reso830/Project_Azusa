import { z } from 'zod';
import {
  OrganizationError,
  validate,
  ValidationError,
} from '@/application/organization/errors';
import { IdPathSchema } from '@/domain/organization/schemas';
import {
  FoundationError,
  getCachedDbError,
  getDbContext,
} from '@/persistence/client';

export type OrganizationRouteContext = { params: Promise<{ id: string }> };

const emptyQuery = z.strictObject({});
const responseHeaders = { 'Cache-Control': 'no-store' };

export function readQuery<T>(request: Request, schema: z.ZodType<T>): T {
  const params = new URL(request.url).searchParams;
  const seen = new Set<string>();
  for (const key of params.keys()) {
    if (seen.has(key)) {
      throw new ValidationError('Duplicate query parameter.', [
        { path: [key], message: 'Provide this parameter once.' },
      ]);
    }
    seen.add(key);
  }
  return validate(schema, Object.fromEntries(params));
}

export async function readBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  readQuery(request, emptyQuery);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError('Request body must be valid JSON.');
  }
  return validate(schema, body);
}

export async function readId(
  context: OrganizationRouteContext,
): Promise<string> {
  return validate(IdPathSchema, await context.params).id;
}

export function requireNoQuery(request: Request) {
  readQuery(request, emptyQuery);
}

export async function organizationDb() {
  const failure = getCachedDbError();
  if (failure) throw failure;
  return (await getDbContext()).db;
}

export async function organizationResponse(
  operation: () => Promise<unknown>,
  status = 200,
) {
  try {
    return Response.json(await operation(), {
      status,
      headers: responseHeaders,
    });
  } catch (error) {
    if (error instanceof OrganizationError) {
      return Response.json(
        { error: error.toJSON() },
        { status: error.status, headers: responseHeaders },
      );
    }
    const failure =
      getCachedDbError() ??
      (error instanceof FoundationError ? error : undefined);
    if (failure) {
      return Response.json(
        {
          error: {
            code: 'DB_UNAVAILABLE',
            message: 'The organization database is unavailable.',
            details: [
              { stage: failure.stage, recoveryHint: failure.recoveryHint },
            ],
          },
        },
        { status: 503, headers: responseHeaders },
      );
    }
    console.error('Organization API request failed', error);
    return Response.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'The organization request could not be completed.',
          details: [],
        },
      },
      { status: 500, headers: responseHeaders },
    );
  }
}
