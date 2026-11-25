import {
  deleteCategory,
  updateCategory,
} from '@/application/categories/category-service';
import { UpdateCategorySchema } from '@/domain/categories/schemas';
import {
  organizationDb,
  organizationResponse,
  readBody,
  readId,
  requireNoQuery,
  type OrganizationRouteContext,
} from '../../organization/http';

export function PATCH(request: Request, context: OrganizationRouteContext) {
  return organizationResponse(async () => {
    const id = await readId(context);
    const input = await readBody(request, UpdateCategorySchema);
    return updateCategory(await organizationDb(), id, input);
  });
}

export function DELETE(request: Request, context: OrganizationRouteContext) {
  return organizationResponse(async () => {
    const id = await readId(context);
    requireNoQuery(request);
    return deleteCategory(await organizationDb(), id);
  });
}
