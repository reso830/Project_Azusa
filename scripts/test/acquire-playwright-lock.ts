import { acquireDbLock } from '../../src/persistence/lock';

export async function acquirePlaywrightLock(
  dbDir: string,
  onCompromised: (error: Error) => void,
) {
  // Playwright can force-kill its server, leaving the previous lock until stale.
  const deadline = Date.now() + 15000;
  for (;;) {
    try {
      return await acquireDbLock(dbDir, 'cli:migrate', { onCompromised });
    } catch (error) {
      const remaining = deadline - Date.now();
      if ((error as NodeJS.ErrnoException).code !== 'ELOCKED' || remaining <= 0)
        throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(250, remaining)),
      );
    }
  }
}
