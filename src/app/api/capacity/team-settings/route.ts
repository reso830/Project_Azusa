import { updateTeamCapacitySettings } from '@/application/capacity/capacity-service';
import { UpdateTeamCapacitySettingsSchema } from '@/domain/capacity/schemas';
import {
  organizationDb,
  organizationResponse,
  readBody,
} from '../../organization/http';

export function PATCH(request: Request) {
  return organizationResponse(async () => {
    const input = await readBody(request, UpdateTeamCapacitySettingsSchema);
    return updateTeamCapacitySettings(await organizationDb(), input);
  });
}
