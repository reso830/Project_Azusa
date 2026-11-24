import { describe, expect, it } from 'vitest';
import {
  computeTeamIterationSchedule,
  dateRangesOverlap,
  formatTodaySprintLabel,
  isWeekday,
  resolveTodayCadenceStatus,
  shiftWorkdays,
  suggestYywwName,
  validateIterationInPi,
  validatePiContainsIterations,
  validatePiNoOverlap,
} from '../../src/domain/organization/cadence';
import { getTodayWidgetModel } from '../../src/domain/calendar/iso-week';

const pi = {
  id: 'pi',
  trainId: 'train',
  name: 'PI 1',
  startDate: '2027-01-04',
  endDate: '2027-01-15',
};
const sprint = {
  id: 'sprint',
  piId: pi.id,
  name: '2702',
  kind: 'development' as const,
  startDate: pi.startDate,
  endDate: pi.endDate,
};

describe('organization cadence', () => {
  it('validates weekdays and shifts across weekends without changing canonical dates', () => {
    expect(isWeekday('2027-01-09')).toBe(false);
    expect(isWeekday('2027-01-10')).toBe(false);
    expect(shiftWorkdays('2027-01-04', -1)).toBe('2027-01-01');
    expect(shiftWorkdays('2027-01-15', 1)).toBe('2027-01-18');
    expect(shiftWorkdays('2027-01-09', 0)).toBe('2027-01-09');
    for (const offset of [-1, 0, 1] as const) {
      const first = computeTeamIterationSchedule(sprint, 'team', offset);
      for (const piId of [pi.id, 'next-pi']) {
        const second = computeTeamIterationSchedule(
          { ...sprint, piId, startDate: '2027-01-18', endDate: '2027-01-22' },
          'team',
          offset,
        );
        expect(first.scheduledEndDate < second.scheduledStartDate).toBe(true);
      }
      expect(first).toMatchObject({
        canonicalStartDate: pi.startDate,
        canonicalEndDate: pi.endDate,
        iterationId: sprint.id,
      });
    }
  });

  it('validates inclusive overlap, containment and PI changes', () => {
    const touching = {
      ...pi,
      id: 'other',
      startDate: pi.endDate,
      endDate: '2027-01-29',
    };
    expect(dateRangesOverlap(pi, touching)).toBe(true);
    expect(validatePiNoOverlap(touching, [pi])).toEqual({
      reason: 'overlap',
      conflictingRecord: pi,
    });
    expect(
      validatePiNoOverlap({ ...touching, trainId: 'other' }, [pi]),
    ).toBeNull();
    expect(
      validatePiNoOverlap({ ...touching, startDate: '2027-01-18' }, [pi]),
    ).toBeNull();
    expect(
      validatePiNoOverlap({ ...touching, startDate: '2027-02-01' }, [pi]),
    ).toEqual({ reason: 'date-order' });
    expect(validateIterationInPi(sprint, pi, [])).toBeNull();
    expect(
      validateIterationInPi({ ...sprint, id: 'other' }, pi, [sprint]),
    ).toEqual({ reason: 'overlap', conflictingRecord: sprint });
    expect(
      validateIterationInPi({ ...sprint, startDate: '2027-01-09' }, pi, []),
    ).toEqual({ reason: 'weekend-boundary' });
    expect(
      validateIterationInPi({ ...sprint, endDate: '2027-01-10' }, pi, []),
    ).toEqual({ reason: 'weekend-boundary' });
    expect(
      validateIterationInPi({ ...sprint, endDate: '2027-01-18' }, pi, []),
    ).toEqual({ reason: 'outside-pi' });
    expect(
      validatePiContainsIterations({ ...pi, endDate: '2027-01-14' }, [sprint]),
    ).toEqual({ reason: 'outside-pi', conflictingRecord: sprint });
  });

  it('uses ISO week years and preserves existing Sprint prefixes', () => {
    expect(suggestYywwName('2026-12-31')).toBe('2653');
    expect(suggestYywwName('2027-01-01')).toBe('2653');
    expect(
      ['2706', 'Sprint 5', 'sprint 12'].map(formatTodaySprintLabel),
    ).toEqual(['Sprint 2706', 'Sprint 5', 'sprint 12']);
  });

  it('matches shifted dates outside PI bounds and breaks ties by canonical dates', () => {
    const early = computeTeamIterationSchedule(sprint, 'team', -1);
    const late = computeTeamIterationSchedule(sprint, 'team', 1);
    expect(resolveTodayCadenceStatus('2027-01-01', pi, [early]).label).toBe(
      'PI 1 · Sprint 2702',
    );
    expect(resolveTodayCadenceStatus('2027-01-18', pi, [late]).label).toBe(
      'PI 1 · Sprint 2702',
    );
    expect(resolveTodayCadenceStatus('2027-01-18', pi, [early]).label).toBe(
      'PI 1 · No active Sprint',
    );
    const competing = {
      ...late,
      name: 'other',
      canonicalStartDate: '2026-12-28',
      canonicalEndDate: '2027-01-01',
    };
    expect(
      resolveTodayCadenceStatus('2027-01-05', pi, [competing, late]).sprintName,
    ).toBe('2702');
    expect(
      resolveTodayCadenceStatus('2027-01-18', pi, [late, competing]).sprintName,
    ).toBe('other');
    expect(
      getTodayWidgetModel(
        new Date('2027-01-18T12:00:00Z'),
        'UTC',
        'PI 1 · Sprint 2702',
      ).piSprintText,
    ).toBe('PI 1 · Sprint 2702');
  });
});
