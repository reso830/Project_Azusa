import type { z } from 'zod';
import type { HealthResponseSchema } from '../../domain/health/schemas';
import styles from './shell.module.css';
export function ErrorAlertBanner({
  health,
}: {
  health: z.infer<typeof HealthResponseSchema>;
}) {
  if (health.status !== 'error') return null;
  return (
    <div role="alert" className={styles.errorBanner}>
      {health.errors.map((error, index) => (
        <div key={index}>
          <strong>
            {error.stage}: {error.message}
          </strong>
          <p>
            {error.recoveryHint}
            {!error.recoveryHint.includes(
              'docs/operations/database-and-recovery.md',
            ) && (
              <>
                {' '}
                See <code>docs/operations/database-and-recovery.md</code>.
              </>
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
