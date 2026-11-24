import {
  listTrains,
  createTrain,
} from '@/application/organization/organization-service';
import {
  ListTrainsQuerySchema,
  CreateTrainSchema,
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
    const input = readQuery(request, ListTrainsQuerySchema);
    return listTrains(await organizationDb(), input);
  });
}

export function POST(request: Request) {
  return organizationResponse(async () => {
    const input = await readBody(request, CreateTrainSchema);
    return createTrain(await organizationDb(), input);
  }, 201);
}
