import { upsertOverheadDeduction } from '@/application/capacity/capacity-service';
import { UpsertOverheadDeductionSchema } from '@/domain/capacity/schemas';
import {
  organizationDb,
  organizationResponse,
  readBody,
} from '../../organization/http';

export function PUT(request: Request) {
  return organizationResponse(async () => {
    const input = await readBody(request, UpsertOverheadDeductionSchema);
    return upsertOverheadDeduction(await organizationDb(), input);
  });
}
