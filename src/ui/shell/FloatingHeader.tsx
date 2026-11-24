'use client';

import { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { NavigationMenu } from './NavigationMenu';
import { TodayWidget } from './TodayWidget';
import { ExpandableSearch } from './ExpandableSearch';
import { ProfileMenu } from './ProfileMenu';
import { HeaderContextSelector } from './HeaderContextSelector';
import { AsanohaBackground } from './AsanohaBackground';
import styles from './shell.module.css';

type Overlay = 'navigation' | 'profile' | 'team' | 'pi' | 'search';

export function FloatingHeader() {
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const setOpen = useCallback((id: Overlay, open: boolean) => {
    setOverlay((current) => (open ? id : current === id ? null : current));
  }, []);
  const navigation = useCallback(
    (open: boolean) => setOpen('navigation', open),
    [setOpen],
  );
  const profile = useCallback(
    (open: boolean) => setOpen('profile', open),
    [setOpen],
  );
  const team = useCallback((open: boolean) => setOpen('team', open), [setOpen]);
  const pi = useCallback((open: boolean) => setOpen('pi', open), [setOpen]);
  const search = useCallback(
    (open: boolean) => setOpen('search', open),
    [setOpen],
  );
  const organization = usePathname() === '/organization';
  return (
    <header className={styles.header}>
      <div aria-hidden="true" className={styles.headerFade}>
        <AsanohaBackground id="asanoha-header" />
      </div>
      <NavigationMenu
        open={overlay === 'navigation'}
        onOpenChange={navigation}
      />
      {!organization && (
        <>
          <HeaderContextSelector
            open={overlay === 'team' || overlay === 'pi' ? overlay : null}
            onTeamOpenChange={team}
            onPiOpenChange={pi}
          />
          <TodayWidget hiddenForSearchOverlap={overlay === 'search'} />
        </>
      )}
      <div
        className={`${styles.headerActions} ${organization ? styles.organizationActions : ''}`}
      >
        <ExpandableSearch
          expanded={overlay === 'search'}
          onExpandedChange={search}
          placeholder={
            organization ? 'Search organization…' : 'Search stories, features…'
          }
        />
        <ProfileMenu open={overlay === 'profile'} onOpenChange={profile} />
      </div>
    </header>
  );
}
