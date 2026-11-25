import { reorderCategories } from '@/application/categories/category-service';
import { ReorderCategoriesSchema } from '@/domain/categories/schemas';
import {
  organizationDb,
  organizationResponse,
  readBody,
} from '../../organization/http';

export function POST(request: Request) {
  return organizationResponse(async () => {
    const input = await readBody(request, ReorderCategoriesSchema);
    return reorderCategories(await organizationDb(), input);
  });
}
