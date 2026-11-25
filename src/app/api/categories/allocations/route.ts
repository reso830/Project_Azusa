import {
  getTeamPiAllocation,
  resetTeamPiAllocation,
  saveTeamPiAllocation,
} from '@/application/categories/category-service';
import {
  SaveTeamPiAllocationSchema,
  TeamPiAllocationQuerySchema,
} from '@/domain/categories/schemas';
import {
  organizationDb,
  organizationResponse,
  readBody,
  readQuery,
} from '../../organization/http';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return organizationResponse(async () => {
    const input = readQuery(request, TeamPiAllocationQuerySchema);
    return getTeamPiAllocation(await organizationDb(), input);
  });
}

export function PUT(request: Request) {
  return organizationResponse(async () => {
    const input = await readBody(request, SaveTeamPiAllocationSchema);
    return saveTeamPiAllocation(await organizationDb(), input);
  });
}

export function DELETE(request: Request) {
  return organizationResponse(async () => {
    const input = readQuery(request, TeamPiAllocationQuerySchema);
    return resetTeamPiAllocation(await organizationDb(), input);
  });
}
