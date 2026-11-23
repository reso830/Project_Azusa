import { PlaceholderScreen } from '../../ui/shell/PlaceholderScreen';
import { destinations } from '../../ui/shell/nav-config';
import { getPageHealth } from '../../ui/shell/page-health';
export const metadata = { title: 'Team PI brief · Azusa' };
export const dynamic = 'force-dynamic';
export default async function Page() {
  return (
    <PlaceholderScreen
      key="pi-brief"
      destination={destinations[2]!}
      health={await getPageHealth()}
    />
  );
}
