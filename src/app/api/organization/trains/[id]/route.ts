import {
  updateTrain,
  deleteTrain,
} from '@/application/organization/organization-service';
import { UpdateTrainSchema } from '@/domain/organization/schemas';
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
    const input = await readBody(request, UpdateTrainSchema);
    return updateTrain(await organizationDb(), id, input);
  });
}

export function DELETE(request: Request, context: OrganizationRouteContext) {
  return organizationResponse(async () => {
    const id = await readId(context);
    requireNoQuery(request);
    return deleteTrain(await organizationDb(), id);
  });
}
