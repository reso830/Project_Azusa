import { it, expect } from 'vitest';
import {
  computeIsoCalendarWeek,
  formatViewerClock,
  getTodayWidgetModel,
  normalizeTimeZone,
  resolveTimeZoneAbbreviation,
} from '../../src/domain/calendar/iso-week';
it('computes ISO boundaries', () => {
  expect(computeIsoCalendarWeek(2026, 11, 8).formatted).toBe('CW45.7');
  expect(computeIsoCalendarWeek(2027, 1, 1).formatted).toBe('CW53.5');
  expect(computeIsoCalendarWeek(2027, 1, 4).formatted).toBe('CW01.1');
  expect(computeIsoCalendarWeek(2028, 2, 29).formatted).toBe('CW09.2');
});
it('uses local date and offsets', () => {
  const d = new Date('2026-11-08T18:30:00Z');
  expect(getTodayWidgetModel(d, 'Asia/Manila')).toMatchObject({
    piSprintText: 'No active PI \u00b7 No active Sprint',
    dateText: '2026/11/09',
    cwText: 'CW46.1',
    clockTime: '0230h',
    clockZone: 'PHT',
  });
  expect(formatViewerClock(d, 'bad')).toEqual({ time: '1830h', zone: 'UTC' });
  expect(normalizeTimeZone('US/Central')).toBe('America/Chicago');
  expect(resolveTimeZoneAbbreviation(d, 'Asia/Kathmandu')).toBe('UTC+5:45');
  expect(
    resolveTimeZoneAbbreviation(
      new Date('2026-07-01T00:00:00Z'),
      'Europe/London',
    ),
  ).toBe('UTC+1');
});
it('covers additional calendar and timezone boundaries', () => {
  expect(computeIsoCalendarWeek(2026, 12, 31).formatted).toBe('CW53.4');
  expect(normalizeTimeZone('Asia/Calcutta')).toBe('Asia/Kolkata');
  expect(normalizeTimeZone('')).toBe('UTC');
  expect(
    resolveTimeZoneAbbreviation(
      new Date('2026-01-01T00:00:00Z'),
      'Europe/London',
    ),
  ).toBe('UTC');
  expect(
    resolveTimeZoneAbbreviation(
      new Date('2026-01-01T00:00:00Z'),
      'Asia/Kolkata',
    ),
  ).toBe('IST');
  expect(formatViewerClock(new Date('2026-01-01T03:04:00Z'))).toEqual({
    time: '0304h',
    zone: 'UTC',
  });
});

it('formats named zones and zero-offset fallback', () => {
  const date = new Date('2026-01-01T00:00:00Z');
  for (const [zone, expected] of [
    ['Asia/Tokyo', 'JST'],
    ['Asia/Singapore', 'SGT'],
    ['UTC', 'UTC'],
    ['Etc/UTC', 'UTC'],
    ['Etc/GMT', 'UTC'],
    ['Africa/Abidjan', 'UTC'],
    ['asia/manila', 'PHT'],
  ]) {
    expect(resolveTimeZoneAbbreviation(date, zone)).toBe(expected);
  }
});
