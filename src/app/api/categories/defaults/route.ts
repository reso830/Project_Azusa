import { saveArtDefaultAllocations } from '@/application/categories/category-service';
import { SaveArtDefaultsSchema } from '@/domain/categories/schemas';
import {
  organizationDb,
  organizationResponse,
  readBody,
} from '../../organization/http';

export function PUT(request: Request) {
  return organizationResponse(async () => {
    const input = await readBody(request, SaveArtDefaultsSchema);
    return saveArtDefaultAllocations(await organizationDb(), input);
  });
}
