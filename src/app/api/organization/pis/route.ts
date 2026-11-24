import { listPis, createPi } from '@/application/organization/cadence-service';
import {
  ListPisQuerySchema,
  CreatePiSchema,
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
    const input = readQuery(request, ListPisQuerySchema);
    return listPis(await organizationDb(), input);
  });
}

export function POST(request: Request) {
  return organizationResponse(async () => {
    const input = await readBody(request, CreatePiSchema);
    return createPi(await organizationDb(), input);
  }, 201);
}
