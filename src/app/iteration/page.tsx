import { PlaceholderScreen } from '../../ui/shell/PlaceholderScreen';
import { destinations } from '../../ui/shell/nav-config';
import { getPageHealth } from '../../ui/shell/page-health';
export const metadata = { title: 'Iteration board · Azusa' };
export const dynamic = 'force-dynamic';
export default async function Page() {
  return (
    <PlaceholderScreen
      key="iteration"
      destination={destinations[7]!}
      health={await getPageHealth()}
    />
  );
}
