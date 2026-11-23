import { DiagnosticCheckRequestSchema } from '../../../../domain/health/schemas';
import { recordDiagnosticCheck } from '../../../../application/health/health-service';
export async function POST(request: Request) {
  let data: unknown;
  try {
    data = await request.json();
  } catch {
    return Response.json(
      { ok: false, error: 'Invalid request payload', issues: [] },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  const parsed = DiagnosticCheckRequestSchema.safeParse(data);
  if (!parsed.success)
    return Response.json(
      {
        ok: false,
        error: 'Invalid request payload',
        issues: parsed.error.issues,
      },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  const result = await recordDiagnosticCheck(parsed.data);
  return Response.json(result, {
    status: result.ok ? 201 : result.statusCode,
    headers: { 'Cache-Control': 'no-store' },
  });
}
