import { bulkApplyOverheadDeductions } from '@/application/capacity/capacity-service';
import { BulkApplyOverheadDeductionsSchema } from '@/domain/capacity/schemas';
import {
  organizationDb,
  organizationResponse,
  readBody,
} from '../../../organization/http';

export function POST(request: Request) {
  return organizationResponse(async () => {
    const input = await readBody(request, BulkApplyOverheadDeductionsSchema);
    return bulkApplyOverheadDeductions(await organizationDb(), input);
  });
}
