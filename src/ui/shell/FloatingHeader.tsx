'use client';
import { useCallback, useState } from 'react';
import { NavigationMenu } from './NavigationMenu';
import { TodayWidget } from './TodayWidget';
import { ExpandableSearch } from './ExpandableSearch';
import { ProfileMenu } from './ProfileMenu';
import { AsanohaBackground } from './AsanohaBackground';
import styles from './shell.module.css';
export function FloatingHeader() {
  const [overlay, setOverlay] = useState<'navigation' | 'profile' | null>(null);
  const [search, setSearch] = useState(false);
  const navigation = useCallback(
    (open: boolean) =>
      setOverlay((current) =>
        open ? 'navigation' : current === 'navigation' ? null : current,
      ),
    [],
  );
  const profile = useCallback(
    (open: boolean) =>
      setOverlay((current) =>
        open ? 'profile' : current === 'profile' ? null : current,
      ),
    [],
  );
  return (
    <header className={styles.header}>
      <div aria-hidden="true" className={styles.headerFade}>
        <AsanohaBackground id="asanoha-header" />
      </div>
      <NavigationMenu
        open={overlay === 'navigation'}
        onOpenChange={navigation}
      />
      <TodayWidget hiddenForSearchOverlap={search} />
      <div className={styles.headerActions}>
        <ExpandableSearch onExpandedChange={setSearch} />
        <ProfileMenu open={overlay === 'profile'} onOpenChange={profile} />
      </div>
    </header>
  );
}
