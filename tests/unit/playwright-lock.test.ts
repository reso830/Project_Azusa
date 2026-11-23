import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { acquirePlaywrightLock } from '../../scripts/test/acquire-playwright-lock';

const acquire = vi.hoisted(() => vi.fn());
vi.mock('../../src/persistence/lock', () => ({ acquireDbLock: acquire }));
beforeEach(() => {
  acquire.mockReset();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

it('waits for a previous browser server lock to go stale and preserves the release and compromise handlers', async () => {
  const started = Date.now();
  const release = vi.fn();
  const onCompromised = vi.fn();
  const locked = Object.assign(new Error('Previous server lock'), {
    code: 'ELOCKED',
  });
  acquire.mockImplementation(async () => {
    if (Date.now() - started < 10000) throw locked;
    return release;
  });
  const result = acquirePlaywrightLock('isolated-db', onCompromised);
  await Promise.all([
    expect(result).resolves.toBe(release),
    vi.runAllTimersAsync(),
  ]);
  expect(acquire).toHaveBeenLastCalledWith('isolated-db', 'cli:migrate', {
    onCompromised,
  });
  expect(Date.now() - started).toBeGreaterThanOrEqual(10000);
  expect(Date.now() - started).toBeLessThanOrEqual(15000);
});

it('gives up after fifteen seconds if the lock remains held', async () => {
  const started = Date.now();
  const locked = Object.assign(new Error('Still held'), { code: 'ELOCKED' });
  acquire.mockRejectedValue(locked);
  const result = acquirePlaywrightLock('isolated-db', vi.fn());
  await Promise.all([
    expect(result).rejects.toBe(locked),
    vi.runAllTimersAsync(),
  ]);
  expect(Date.now() - started).toBe(15000);
});

it.each(['EACCES', 'ECOMPROMISED'])(
  'immediately propagates %s instead of retrying',
  async (code) => {
    const error = Object.assign(new Error('Not contention'), { code });
    acquire.mockRejectedValue(error);
    await expect(acquirePlaywrightLock('isolated-db', vi.fn())).rejects.toBe(
      error,
    );
    expect(acquire).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  },
);
