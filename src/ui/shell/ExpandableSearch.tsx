'use client';
import { useRef, useState } from 'react';
import { KumikoIcon } from '../icons/KumikoIcon';
import styles from './shell.module.css';
export function ExpandableSearch({
  onExpandedChange,
}: {
  onExpandedChange: (expanded: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function change(next: boolean) {
    setExpanded(next);
    onExpandedChange(next);
  }
  return expanded ? (
    <label className={styles.searchField}>
      <KumikoIcon name="search" size={15} color="var(--color-muted)" />
      <span className={styles.srOnly}>Search</span>
      <input
        type="search"
        autoFocus
        placeholder="Search stories, features…"
        onBlur={() => change(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            change(false);
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
      onClick={() => change(true)}
    >
      <KumikoIcon name="search" size={16} />
    </button>
  );
}
