'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { formatProfileSubtitle } from '../../domain/organization/context';
import { KumikoIcon } from '../icons/KumikoIcon';
import { useOrganizationContext } from './OrganizationContext';
import styles from './shell.module.css';
export function ProfileMenu({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const organization = useRef<HTMLAnchorElement>(null);
  const settings = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const { selected } = useOrganizationContext();
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [onOpenChange]);
  return (
    <div
      ref={root}
      className={styles.profile}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          onOpenChange(false);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault();
          onOpenChange(false);
          trigger.current?.focus();
        }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault();
          const last =
            event.key === 'End' ||
            (event.key === 'ArrowUp' &&
              document.activeElement !== settings.current) ||
            (event.key === 'ArrowDown' &&
              document.activeElement === organization.current);
          if (!open) onOpenChange(true);
          requestAnimationFrame(() =>
            (last ? settings : organization).current?.focus(),
          );
        }
      }}
    >
      <button
        ref={trigger}
        className={styles.avatar}
        aria-label="Account menu for SM"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="azusa-profile-menu"
        onClick={() => onOpenChange(!open)}
      >
        SM
      </button>
      {open && (
        <div
          id="azusa-profile-menu"
          role="menu"
          aria-label="Account"
          className={styles.profilePanel}
        >
          <div className={styles.profileIdentity}>
            <span aria-hidden="true" className={styles.smallAvatar}>
              SM
            </span>
            <span>
              <b>Scrum Master</b>
              <span className={styles.subtitle}>
                {formatProfileSubtitle(selected)}
              </span>
            </span>
          </div>
          <Link
            ref={organization}
            href="/organization"
            prefetch={false}
            role="menuitem"
            aria-current={pathname === '/organization' ? 'page' : undefined}
            className={styles.organizationLink}
            onClick={() => onOpenChange(false)}
          >
            <KumikoIcon name="members" size={18} />
            Organization
          </Link>
          <button
            ref={settings}
            type="button"
            role="menuitem"
            aria-disabled="true"
            aria-describedby="settings-help"
            className={styles.settings}
          >
            <KumikoIcon name="settings" size={18} color="#B9B2A8" />
            Settings
          </button>
          <p id="settings-help" className={styles.settingsHelp}>
            Configured per feature (F002–F014)
          </p>
        </div>
      )}
    </div>
  );
}
