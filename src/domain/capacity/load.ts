import type { LoadResult, LoadThresholds } from './types';

export const DEFAULT_LOAD_THRESHOLDS = { underMax: 85, overMin: 115 } as const;

export function calculateLoad(
  plannedSp: number,
  forecastSp: number,
  thresholds: LoadThresholds = DEFAULT_LOAD_THRESHOLDS,
): LoadResult {
  if (forecastSp === 0) {
    return {
      plannedSp,
      forecastSp,
      loadPct: null,
      band: plannedSp > 0 ? 'red' : 'none',
    };
  }
  const loadPct = (plannedSp * 100) / forecastSp;
  const band =
    loadPct < thresholds.underMax
      ? 'amber'
      : loadPct > thresholds.overMin
        ? 'red'
        : 'green';
  return { plannedSp, forecastSp, loadPct, band };
}
