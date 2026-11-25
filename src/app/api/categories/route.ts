import {
  createCategory,
  listCategories,
} from '@/application/categories/category-service';
import {
  CreateCategorySchema,
  ListCategoriesQuerySchema,
} from '@/domain/categories/schemas';
import {
  organizationDb,
  organizationResponse,
  readBody,
  readQuery,
} from '../organization/http';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return organizationResponse(async () => {
    const input = readQuery(request, ListCategoriesQuerySchema);
    return listCategories(await organizationDb(), input);
  });
}

export function POST(request: Request) {
  return organizationResponse(async () => {
    const input = await readBody(request, CreateCategorySchema);
    return createCategory(await organizationDb(), input);
  }, 201);
}
