import {
  listIterations,
  createIteration,
} from '@/application/organization/cadence-service';
import {
  ListIterationsQuerySchema,
  CreateIterationSchema,
} from '@/domain/organization/schemas';
import {
  organizationDb,
  organizationResponse,
  readId,
  type OrganizationRouteContext,
  readQuery,
  readBody,
} from '../../../http';

export const dynamic = 'force-dynamic';

export function GET(request: Request, context: OrganizationRouteContext) {
  return organizationResponse(async () => {
    const id = await readId(context);
    const input = readQuery(request, ListIterationsQuerySchema);
    return listIterations(await organizationDb(), id, input);
  });
}

export function POST(request: Request, context: OrganizationRouteContext) {
  return organizationResponse(async () => {
    const id = await readId(context);
    const input = await readBody(request, CreateIterationSchema);
    return createIteration(await organizationDb(), id, input);
  }, 201);
}
