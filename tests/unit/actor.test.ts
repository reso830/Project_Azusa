import { describe, it, expect } from 'vitest';
import { resolveActor } from '../../src/domain/audit/actor';
describe('resolveActor', () => {
  it('applies precedence and trimming', () => {
    expect(resolveActor(' a ', ' b ')).toBe('a');
    expect(resolveActor('  ', ' b ')).toBe('b');
    expect(resolveActor('', '')).toBe('local:sm');
  });
  it('uses environment', () => {
    const prev = process.env.AZUSA_ACTOR_ID;
    try {
      process.env.AZUSA_ACTOR_ID = ' env ';
      expect(resolveActor()).toBe('env');
    } finally {
      if (prev === undefined) delete process.env.AZUSA_ACTOR_ID;
      else process.env.AZUSA_ACTOR_ID = prev;
    }
  });
});
