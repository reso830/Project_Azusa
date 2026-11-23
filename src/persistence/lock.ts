import lockfile from 'proper-lockfile';
import path from 'node:path';
import { mkdir, writeFile, rm } from 'node:fs/promises';
export const LOCK_CONTENTION_MESSAGE =
  'Database is currently locked. Stop the running Azusa server before running this command.';
export function lockErrorMessage(error: unknown): string {
  return (error as { code?: string })?.code === 'ELOCKED'
    ? LOCK_CONTENTION_MESSAGE
    : error instanceof Error
      ? error.message
      : String(error);
}
export async function acquireDbLock(
  dir: string,
  processType: 'server' | 'cli:migrate' | 'cli:backup' | 'cli:restore',
  options: { staleMs?: number; onCompromised: (err: Error) => void },
) {
  const full = path.resolve(dir);
  const parent = path.dirname(full);
  await mkdir(parent, { recursive: true });
  const sentinel = path.join(parent, `${path.basename(full)}.azusa-lock`);
  let compromised: Error | undefined;
  let rejectWait: ((error: Error) => void) | undefined;
  const lost = new Promise<never>((_, reject) => {
    rejectWait = reject;
  });
  // Attach a handler even after the grace period has completed.
  void lost.catch(() => {});
  const release = await lockfile.lock(sentinel, {
    realpath: false,
    retries: 0,
    stale: options?.staleMs ?? 10000,
    update: 2000,
    onCompromised: (e) => {
      compromised = e;
      rejectWait?.(e);
      options.onCompromised(e);
    },
  });
  try {
    await Promise.race([
      new Promise((resolve) => setTimeout(resolve, 2100)),
      lost,
    ]);
    if (compromised) throw compromised;
  } catch (error) {
    await release().catch(() => {});
    throw error;
  }
  const ownerPath = `${full}.azusa-owner.json`;
  await writeFile(
    ownerPath,
    JSON.stringify({
      pid: process.pid,
      processType,
      acquiredAt: new Date().toISOString(),
    }),
  ).catch(() => {});
  return async () => {
    if (!compromised) await rm(ownerPath, { force: true }).catch(() => {});
    await release();
  };
}
