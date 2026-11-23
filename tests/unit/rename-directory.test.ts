import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renameDirectory } from '../../src/persistence/rename-directory';

const mocks = vi.hoisted(() => ({ rename: vi.fn(), platform: 'win32' }));
vi.mock('node:fs/promises', () => ({ rename: mocks.rename }));
vi.mock('node:process', () => ({
  get platform() {
    return mocks.platform;
  },
}));

beforeEach(() => {
  mocks.rename.mockReset();
  mocks.platform = 'win32';
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

it.each(['EPERM', 'EACCES', 'EBUSY'])(
  'recovers from a transient Windows %s without abandoning the lock',
  async (code) => {
    mocks.rename
      .mockRejectedValueOnce(Object.assign(new Error('File in use'), { code }))
      .mockResolvedValue(undefined);
    const check = vi.fn();
    const result = renameDirectory('staging', 'restored', check);
    const assertion = expect(result).resolves.toBeUndefined();
    await Promise.all([assertion, vi.runAllTimersAsync()]);
    expect(mocks.rename).toHaveBeenCalledTimes(2);
    expect(check).toHaveBeenCalledTimes(2);
  },
);

it('bounds retries and preserves a persistent filesystem error', async () => {
  const error = Object.assign(new Error('Permission denied'), {
    code: 'EPERM',
  });
  mocks.rename.mockRejectedValue(error);
  const result = renameDirectory('staging', 'restored');
  const assertion = expect(result).rejects.toBe(error);
  await Promise.all([assertion, vi.runAllTimersAsync()]);
  expect(mocks.rename).toHaveBeenCalledTimes(5);
});

it('aborts before retrying if the database lock was lost during the delay', async () => {
  mocks.rename.mockRejectedValue(
    Object.assign(new Error('File in use'), { code: 'EPERM' }),
  );
  const lost = new Error('Database lock lost');
  const check = vi
    .fn()
    .mockImplementationOnce(() => {})
    .mockImplementation(() => {
      throw lost;
    });
  const result = renameDirectory('staging', 'restored', check);
  const assertion = expect(result).rejects.toBe(lost);
  await Promise.all([assertion, vi.runAllTimersAsync()]);
  expect(mocks.rename).toHaveBeenCalledTimes(1);
});

it.each(['win32', 'linux'])(
  'does not retry unrelated errors on %s',
  async (platform) => {
    mocks.platform = platform;
    const error = Object.assign(new Error('Source missing'), {
      code: 'ENOENT',
    });
    mocks.rename.mockRejectedValue(error);
    await expect(renameDirectory('staging', 'restored')).rejects.toBe(error);
    expect(mocks.rename).toHaveBeenCalledTimes(1);
  },
);

it('does not retry permission errors on other platforms', async () => {
  mocks.platform = 'linux';
  const error = Object.assign(new Error('Permission denied'), {
    code: 'EPERM',
  });
  mocks.rename.mockRejectedValue(error);
  await expect(renameDirectory('staging', 'restored')).rejects.toBe(error);
  expect(mocks.rename).toHaveBeenCalledTimes(1);
});
