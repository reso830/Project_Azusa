'use client';
import { useState } from 'react';
import type { z } from 'zod';
import type { HealthResponseSchema } from '../../domain/health/schemas';
import type { Destination } from './nav-config';
import { KumikoIcon } from '../icons/KumikoIcon';
import { FoundationStatusCard } from './FoundationStatusCard';
import { ErrorAlertBanner } from './ErrorAlertBanner';
import styles from './shell.module.css';
export function PlaceholderScreen({
  destination,
  health: initialHealth,
}: {
  destination: Destination;
  health: z.infer<typeof HealthResponseSchema>;
}) {
  const [health, setHealth] = useState(initialHealth);
  return (
    <>
      <ErrorAlertBanner health={health} />
      <div className={styles.titleRow}>
        <h1>{destination.title}</h1>
        <span className={styles.featureBadge}>
          {destination.milestone} · {destination.feature}
        </span>
      </div>
      <section className={styles.placeholder}>
        <KumikoIcon name="asanoha" size={40} color="var(--color-muted)" />
        <h2>{destination.title}</h2>
        <p>This feature is not yet implemented.</p>
        <p>
          Planned for {destination.milestone} · {destination.feature}.
        </p>
      </section>
      <FoundationStatusCard health={health} onHealthChange={setHealth} />
    </>
  );
}
