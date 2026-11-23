import { PlaceholderScreen } from '../../ui/shell/PlaceholderScreen';
import { destinations } from '../../ui/shell/nav-config';
import { getPageHealth } from '../../ui/shell/page-health';
export const metadata = { title: 'ART program board · Azusa' };
export const dynamic = 'force-dynamic';
export default async function Page() {
  return (
    <PlaceholderScreen
      key="program-board"
      destination={destinations[1]!}
      health={await getPageHealth()}
    />
  );
}
