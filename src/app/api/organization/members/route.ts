import {
  listMembers,
  createMember,
} from '@/application/organization/organization-service';
import {
  ListMembersQuerySchema,
  CreateMemberSchema,
} from '@/domain/organization/schemas';
import {
  organizationDb,
  organizationResponse,
  readQuery,
  readBody,
} from '../http';

export const dynamic = 'force-dynamic';

export function GET(request: Request) {
  return organizationResponse(async () => {
    const input = readQuery(request, ListMembersQuerySchema);
    return listMembers(await organizationDb(), input);
  });
}

export function POST(request: Request) {
  return organizationResponse(async () => {
    const input = await readBody(request, CreateMemberSchema);
    return createMember(await organizationDb(), input);
  }, 201);
}
