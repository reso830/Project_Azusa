'use client';
import { useRef } from 'react';
import { KumikoIcon } from '../icons/KumikoIcon';
import styles from './shell.module.css';
export function ExpandableSearch({
  expanded,
  placeholder,
  onExpandedChange,
}: {
  expanded: boolean;
  placeholder: string;
  onExpandedChange: (expanded: boolean) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  return expanded ? (
    <label className={styles.searchField}>
      <KumikoIcon name="search" size={15} color="var(--color-muted)" />
      <span className={styles.srOnly}>Search</span>
      <input
        type="search"
        autoFocus
        placeholder={placeholder}
        onBlur={() => onExpandedChange(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onExpandedChange(false);
            requestAnimationFrame(() => trigger.current?.focus());
          }
        }}
      />
    </label>
  ) : (
    <button
      ref={trigger}
      className={styles.searchButton}
      aria-label="Search"
      onClick={() => onExpandedChange(true)}
    >
      <KumikoIcon name="search" size={16} />
    </button>
  );
}
