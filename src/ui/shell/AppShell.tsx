import type { ReactNode } from 'react';
import { AsanohaBackground } from './AsanohaBackground';
import { FloatingHeader } from './FloatingHeader';
import { OrganizationContextProvider } from './OrganizationContext';
import styles from './shell.module.css';
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <AsanohaBackground />
      <OrganizationContextProvider>
        <FloatingHeader />
        <main className={styles.content}>{children}</main>
      </OrganizationContextProvider>
    </div>
  );
}
