import {
  updateLocation,
  deleteLocation,
} from '@/application/organization/calendar-reference-service';
import { UpdateLocationSchema } from '@/domain/organization/schemas';
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
    const input = await readBody(request, UpdateLocationSchema);
    return updateLocation(await organizationDb(), id, input);
  });
}

export function DELETE(request: Request, context: OrganizationRouteContext) {
  return organizationResponse(async () => {
    const id = await readId(context);
    requireNoQuery(request);
    return deleteLocation(await organizationDb(), id);
  });
}
