import { computeIsoCalendarWeek } from '../calendar/iso-week';

type DateRange = { startDate: string; endDate: string };
type PiRange = DateRange & { id?: string; trainId: string };
type IterationRange = DateRange & { id?: string };
type Iteration = DateRange & {
  id: string;
  piId: string;
  name: string;
  kind: 'development' | 'ip';
};
type OffsetWorkdays = -1 | 0 | 1;

export type TeamIterationSchedule = {
  iterationId: string;
  piId: string;
  teamId: string | null;
  name: string;
  kind: Iteration['kind'];
  canonicalStartDate: string;
  canonicalEndDate: string;
  offsetWorkdays: OffsetWorkdays;
  scheduledStartDate: string;
  scheduledEndDate: string;
};

function isWeekdayNumber(day: number): boolean {
  return day >= 1 && day <= 5;
}

export function isWeekday(isoDate: string): boolean {
  return isWeekdayNumber(new Date(`${isoDate}T00:00:00Z`).getUTCDay());
}

export function shiftWorkdays(
  isoDate: string,
  offsetWorkdays: OffsetWorkdays,
): string {
  if (offsetWorkdays === 0) return isoDate;
  const date = new Date(`${isoDate}T00:00:00Z`);
  do {
    date.setUTCDate(date.getUTCDate() + offsetWorkdays);
  } while (
    !isWeekdayNumber(date.getUTCDay()) &&
    Number.isFinite(date.getTime())
  );
  return date.toISOString().slice(0, 10);
}

export function computeTeamIterationSchedule(
  iteration: Iteration,
  teamId: string | null,
  offsetWorkdays: OffsetWorkdays,
): TeamIterationSchedule {
  return {
    iterationId: iteration.id,
    piId: iteration.piId,
    teamId,
    name: iteration.name,
    kind: iteration.kind,
    canonicalStartDate: iteration.startDate,
    canonicalEndDate: iteration.endDate,
    offsetWorkdays,
    scheduledStartDate: shiftWorkdays(iteration.startDate, offsetWorkdays),
    scheduledEndDate: shiftWorkdays(iteration.endDate, offsetWorkdays),
  };
}

export function suggestYywwName(endDate: string): string {
  const [year, month, day] = endDate.split('-').map(Number) as [
    number,
    number,
    number,
  ];
  const { isoYear, isoWeek } = computeIsoCalendarWeek(year, month, day);
  return (
    String(isoYear % 100).padStart(2, '0') + String(isoWeek).padStart(2, '0')
  );
}

export function dateRangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.startDate <= b.endDate && b.startDate <= a.endDate;
}

function contains(outer: DateRange, inner: DateRange): boolean {
  return outer.startDate <= inner.startDate && inner.endDate <= outer.endDate;
}

export function validatePiNoOverlap<T extends PiRange>(
  candidate: PiRange,
  activeSiblings: readonly T[],
) {
  if (candidate.startDate > candidate.endDate)
    return { reason: 'date-order' } as const;
  const conflictingRecord = activeSiblings.find(
    (sibling) =>
      (candidate.id === undefined || sibling.id !== candidate.id) &&
      sibling.trainId === candidate.trainId &&
      dateRangesOverlap(sibling, candidate),
  );
  return conflictingRecord
    ? ({ reason: 'overlap', conflictingRecord } as const)
    : null;
}

export function validateIterationInPi<T extends IterationRange>(
  candidate: IterationRange,
  pi: DateRange,
  siblings: readonly T[],
) {
  if (candidate.startDate > candidate.endDate)
    return { reason: 'date-order' } as const;
  if (!isWeekday(candidate.startDate) || !isWeekday(candidate.endDate))
    return { reason: 'weekend-boundary' } as const;
  if (!contains(pi, candidate)) return { reason: 'outside-pi' } as const;
  const conflictingRecord = siblings.find(
    (sibling) =>
      (candidate.id === undefined || sibling.id !== candidate.id) &&
      dateRangesOverlap(sibling, candidate),
  );
  return conflictingRecord
    ? ({ reason: 'overlap', conflictingRecord } as const)
    : null;
}

export function validatePiContainsIterations<T extends DateRange>(
  updatedPi: DateRange,
  childIterations: readonly T[],
) {
  if (updatedPi.startDate > updatedPi.endDate)
    return { reason: 'date-order' } as const;
  const conflictingRecord = childIterations.find(
    (iteration) => !contains(updatedPi, iteration),
  );
  return conflictingRecord
    ? ({ reason: 'outside-pi', conflictingRecord } as const)
    : null;
}

export function formatTodaySprintLabel(name: string): string {
  return /^sprint\b/i.test(name) ? name : `Sprint ${name}`;
}

export function resolveTodayCadenceStatus(
  todayIsoDate: string,
  selectedPi: { id: string; name: string } | null,
  teamSchedules: readonly TeamIterationSchedule[],
) {
  const containsCanonically = (schedule: TeamIterationSchedule) =>
    schedule.canonicalStartDate <= todayIsoDate &&
    todayIsoDate <= schedule.canonicalEndDate;
  const current = selectedPi
    ? teamSchedules
        .filter(
          (schedule) =>
            schedule.piId === selectedPi.id &&
            schedule.scheduledStartDate <= todayIsoDate &&
            todayIsoDate <= schedule.scheduledEndDate,
        )
        .sort(
          (a, b) =>
            Number(containsCanonically(b)) - Number(containsCanonically(a)) ||
            a.canonicalStartDate.localeCompare(b.canonicalStartDate) ||
            a.iterationId.localeCompare(b.iterationId),
        )[0]
    : undefined;
  const piName = selectedPi?.name ?? null;
  const sprintName = current?.name ?? null;
  return {
    piName,
    sprintName,
    label: `${piName ?? 'No active PI'} · ${sprintName === null ? 'No active Sprint' : formatTodaySprintLabel(sprintName)}`,
  };
}
