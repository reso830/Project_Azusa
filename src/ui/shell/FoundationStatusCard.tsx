'use client';
import { useState } from 'react';
import { z } from 'zod';
import {
  HealthResponseSchema,
  HealthErrorItemSchema,
} from '../../domain/health/schemas';
import styles from './shell.module.css';
type Health = z.infer<typeof HealthResponseSchema>;
export function FoundationStatusCard({
  health,
  onHealthChange,
}: {
  health: Health;
  onHealthChange: (health: Health) => void;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  async function record() {
    setPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/health/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) {
        const failure = HealthErrorItemSchema.safeParse({
          stage: result.stage,
          message: result.error,
          recoveryHint: result.recoveryHint,
        });
        if (failure.success) {
          onHealthChange({
            ...health,
            status: 'error',
            errors: [failure.data],
          });
          return;
        }
        throw new Error(result.error ?? 'Diagnostic check failed');
      }
      onHealthChange(HealthResponseSchema.parse(result.health));
      setMessage('Diagnostic check recorded.');
    } catch (error) {
      onHealthChange({
        ...health,
        status: 'error',
        errors: [
          {
            stage: 'query',
            message: error instanceof Error ? error.message : String(error),
            recoveryHint:
              'Restart and check exclusive database access if the problem persists.',
          },
        ],
      });
    } finally {
      setPending(false);
    }
  }
  return (
    <section aria-labelledby="foundation-heading" className={styles.statusCard}>
      <h2 id="foundation-heading">Foundation status</h2>
      <dl>
        <div>
          <dt>Local database</dt>
          <dd>{health.database.initialized ? 'Initialized' : 'Unavailable'}</dd>
        </div>
        <div>
          <dt>Migrations</dt>
          <dd>
            {health.migrations.count} applied ·{' '}
            {health.migrations.latestTag ?? 'None'}
          </dd>
        </div>
        <div>
          <dt>Startup backups</dt>
          <dd>
            {health.backup.backupCount} / {health.backup.retentionLimit}
          </dd>
        </div>
        <div>
          <dt>Latest backup</dt>
          <dd>
            {health.backup.lastBackupTrigger ?? 'None'}
            {health.backup.lastBackupId && (
              <code>{health.backup.lastBackupId}</code>
            )}
          </dd>
        </div>
        <div>
          <dt>Diagnostic checks</dt>
          <dd>
            {health.latestDiagnostic?.checkCount ?? 0}
            {health.latestDiagnostic && (
              <>
                <code>{health.latestDiagnostic.id}</code>
                <time>{health.latestDiagnostic.updatedAt}</time>
              </>
            )}
          </dd>
        </div>
      </dl>
      <button
        className={styles.diagnosticButton}
        disabled={pending}
        onClick={record}
      >
        {pending ? 'Recording…' : 'Record diagnostic check'}
      </button>
      <p role="status" className={styles.checkMessage}>
        {message}
      </p>
    </section>
  );
}
