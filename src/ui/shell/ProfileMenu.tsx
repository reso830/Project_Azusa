'use client';
import { useEffect, useRef } from 'react';
import { KumikoIcon } from '../icons/KumikoIcon';
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
  const settings = useRef<HTMLButtonElement>(null);
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
          onOpenChange(true);
          requestAnimationFrame(() => settings.current?.focus());
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
              <span className={styles.subtitle}>No ART or team configured</span>
            </span>
          </div>
          <button
            ref={settings}
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
