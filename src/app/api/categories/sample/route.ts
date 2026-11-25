import { applySampleCatalog } from '@/application/categories/category-service';
import { ApplySampleCatalogSchema } from '@/domain/categories/schemas';
import {
  organizationDb,
  organizationResponse,
  readBody,
} from '../../organization/http';

export function POST(request: Request) {
  return organizationResponse(async () => {
    const input = await readBody(request, ApplySampleCatalogSchema);
    return applySampleCatalog(await organizationDb(), input);
  }, 201);
}
