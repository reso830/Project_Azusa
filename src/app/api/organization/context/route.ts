import { getOrganizationContextTree } from '@/application/organization/cadence-service';
import { organizationDb, organizationResponse, requireNoQuery } from '../http';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return organizationResponse(async () => {
    requireNoQuery(request);
    return getOrganizationContextTree(await organizationDb());
  });
}
