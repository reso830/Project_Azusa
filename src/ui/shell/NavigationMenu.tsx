'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { destinations } from './nav-config';
import { KumikoIcon } from '../icons/KumikoIcon';
import styles from './shell.module.css';
export function NavigationMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const root = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [onOpenChange]);
  function keyboard(event: KeyboardEvent) {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      onOpenChange(false);
      trigger.current?.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    if (!open) {
      onOpenChange(true);
      requestAnimationFrame(() => {
        const links = root.current?.querySelectorAll('a');
        links?.[
          event.key === 'ArrowUp' || event.key === 'End' ? links.length - 1 : 0
        ]?.focus();
      });
      return;
    }
    const links = Array.from(root.current?.querySelectorAll('a') ?? []);
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    links[
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? links.length - 1
          : index < 0
            ? event.key === 'ArrowUp'
              ? links.length - 1
              : 0
            : (index + (event.key === 'ArrowUp' ? -1 : 1) + links.length) %
              links.length
    ]?.focus();
  }
  return (
    <nav
      aria-label="Primary navigation"
      ref={root}
      className={styles.navigation}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          onOpenChange(false);
      }}
      onKeyDown={keyboard}
    >
      <button
        ref={trigger}
        className={styles.logoButton}
        aria-label="Open navigation"
        aria-expanded={open}
        aria-controls="azusa-navigation"
        onClick={() => onOpenChange(!open)}
      >
        <Image
          unoptimized
          src="/assets/azusa-logo.png"
          alt="Azusa"
          width="60"
          height="60"
        />
      </button>
      {open && (
        <div id="azusa-navigation" className={styles.navigationPanel}>
          {['PI', 'Capacity', 'Sprint', 'Insights'].map((group) => (
            <div className={styles.navGroup} key={group}>
              <span className={styles.groupLabel}>{group}</span>
              {destinations
                .filter((item) => item.group === group)
                .map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={pathname === item.href ? 'page' : undefined}
                    onClick={() => onOpenChange(false)}
                  >
                    <KumikoIcon name={item.icon} size={18} />
                    {item.title}
                  </Link>
                ))}
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}
