import { cancelPendingMemberMove } from '@/application/organization/organization-service';
import {
  organizationDb,
  organizationResponse,
  readId,
  type OrganizationRouteContext,
  requireNoQuery,
} from '../../../http';

export function DELETE(request: Request, context: OrganizationRouteContext) {
  return organizationResponse(async () => {
    const id = await readId(context);
    requireNoQuery(request);
    return cancelPendingMemberMove(await organizationDb(), id);
  });
}
