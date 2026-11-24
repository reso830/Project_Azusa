import {
  updateIteration,
  deleteIteration,
} from '@/application/organization/cadence-service';
import { UpdateIterationSchema } from '@/domain/organization/schemas';
import {
  organizationDb,
  organizationResponse,
  readId,
  type OrganizationRouteContext,
  readBody,
  requireNoQuery,
} from '../../http';

export function PATCH(request: Request, context: OrganizationRouteContext) {
  return organizationResponse(async () => {
    const id = await readId(context);
    const input = await readBody(request, UpdateIterationSchema);
    return updateIteration(await organizationDb(), id, input);
  });
}

export function DELETE(request: Request, context: OrganizationRouteContext) {
  return organizationResponse(async () => {
    const id = await readId(context);
    requireNoQuery(request);
    return deleteIteration(await organizationDb(), id);
  });
}
