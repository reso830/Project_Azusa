import { OrganizationWorkspace } from '@/ui/organization/OrganizationWorkspace';
import { ErrorAlertBanner } from '@/ui/shell/ErrorAlertBanner';
import { getPageHealth } from '@/ui/shell/page-health';

export const metadata = { title: 'Organization · Azusa' };
export const dynamic = 'force-dynamic';

export default async function OrganizationPage() {
  const health = await getPageHealth();
  return health.status === 'error' ? (
    <ErrorAlertBanner health={health} />
  ) : (
    <OrganizationWorkspace />
  );
}
