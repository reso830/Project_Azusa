import { getFoundationHealth } from '../../../application/health/health-service';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const stage = request.headers.get('x-azusa-test-simulate-error');
  const allowed =
    stage === 'init' || stage === 'migration' || stage === 'backup'
      ? stage
      : undefined;
  const health = await getFoundationHealth({ simulatedErrorStage: allowed });
  return Response.json(health, {
    status: health.status === 'healthy' ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
