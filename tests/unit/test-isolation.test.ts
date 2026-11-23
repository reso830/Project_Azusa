import { it, expect } from 'vitest';
import os from 'node:os';
import path from 'node:path';
it('isolates default database and backup paths from project data', () => {
  const db = process.env.AZUSA_DB_DIR!;
  const backup = process.env.AZUSA_BACKUP_DIR!;
  expect(path.isAbsolute(db)).toBe(true);
  expect(path.isAbsolute(backup)).toBe(true);
  expect(path.relative(os.tmpdir(), db)).not.toMatch(/^\.\./);
  expect(path.dirname(db)).toBe(path.dirname(backup));
  expect(db).not.toContain(path.join('.azusa', 'data'));
  expect(backup).not.toContain(path.join('.azusa', 'data'));
});
