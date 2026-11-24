import {
  updateTeam,
  deleteTeam,
} from '@/application/organization/organization-service';
import { UpdateTeamSchema } from '@/domain/organization/schemas';
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
    const input = await readBody(request, UpdateTeamSchema);
    return updateTeam(await organizationDb(), id, input);
  });
}

export function DELETE(request: Request, context: OrganizationRouteContext) {
  return organizationResponse(async () => {
    const id = await readId(context);
    requireNoQuery(request);
    return deleteTeam(await organizationDb(), id);
  });
}
