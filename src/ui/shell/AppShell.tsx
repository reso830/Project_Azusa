import type { ReactNode } from 'react';
import { AsanohaBackground } from './AsanohaBackground';
import { FloatingHeader } from './FloatingHeader';
import styles from './shell.module.css';
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <AsanohaBackground />
      <FloatingHeader />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
