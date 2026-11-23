import { headers } from 'next/headers';
import { getFoundationHealth } from '../../application/health/health-service';

export async function getPageHealth() {
  const stage = (await headers()).get('x-azusa-test-simulate-error');
  return getFoundationHealth({
    simulatedErrorStage:
      stage === 'init' || stage === 'backup' || stage === 'migration'
        ? stage
        : undefined,
  });
}
