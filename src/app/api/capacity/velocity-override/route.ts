import {
  clearTeamPiVelocityOverride,
  setTeamPiVelocityOverride,
} from '@/application/capacity/capacity-service';
import {
  DeleteTeamPiVelocityOverrideQuerySchema,
  SetTeamPiVelocityOverrideSchema,
} from '@/domain/capacity/schemas';
import {
  organizationDb,
  organizationResponse,
  readBody,
  readQuery,
} from '../../organization/http';

export function PUT(request: Request) {
  return organizationResponse(async () => {
    const input = await readBody(request, SetTeamPiVelocityOverrideSchema);
    return setTeamPiVelocityOverride(await organizationDb(), input);
  });
}

export function DELETE(request: Request) {
  return organizationResponse(async () => {
    const input = readQuery(request, DeleteTeamPiVelocityOverrideQuerySchema);
    return clearTeamPiVelocityOverride(await organizationDb(), input);
  });
}
