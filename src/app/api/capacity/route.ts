import { getTeamPiCapacity } from '@/application/capacity/capacity-service';
import { CapacityViewQuerySchema } from '@/domain/capacity/schemas';
import {
  organizationDb,
  organizationResponse,
  readQuery,
} from '../organization/http';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return organizationResponse(async () => {
    const input = readQuery(request, CapacityViewQuerySchema);
    return getTeamPiCapacity(await organizationDb(), input);
  });
}
