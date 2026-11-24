import { listLocationHolidays } from '@/application/organization/calendar-reference-service';
import { ListHolidaysQuerySchema } from '@/domain/organization/schemas';
import {
  organizationDb,
  organizationResponse,
  readId,
  type OrganizationRouteContext,
  readQuery,
} from '../../../http';

export const dynamic = 'force-dynamic';

export function GET(request: Request, context: OrganizationRouteContext) {
  return organizationResponse(async () => {
    const id = await readId(context);
    const input = readQuery(request, ListHolidaysQuerySchema);
    return listLocationHolidays(await organizationDb(), id, input);
  });
}
