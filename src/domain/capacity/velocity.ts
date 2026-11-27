import type {
  CompletedSprintHistoryEntry,
  ResolvedVelocity,
  VelocitySource,
} from './types';

export function resolveNormalizedVelocity({
  sprintOverride,
  piOverride,
  completedSprints,
  seedValue,
}: {
  sprintOverride?: number | null;
  piOverride?: number | null;
  completedSprints: readonly CompletedSprintHistoryEntry[];
  seedValue?: number | null;
}): ResolvedVelocity {
  const metadata = {
    piOverrideValue: piOverride ?? null,
    seedValue: seedValue ?? null,
  };
  function resolved(
    value: number | null,
    source: VelocitySource,
  ): ResolvedVelocity {
    return {
      ...metadata,
      value,
      source,
      sprintCountUsed: 0,
      totalCompletedSp: null,
      totalActualDevDays: null,
    };
  }

  if (sprintOverride != null)
    return resolved(sprintOverride, 'sprint_override');
  if (piOverride != null) return resolved(piOverride, 'pi_override');

  const recent = [...completedSprints]
    .sort(
      (a, b) =>
        b.endDate.localeCompare(a.endDate) ||
        a.iterationId.localeCompare(b.iterationId),
    )
    .slice(0, 4);
  const totalCompletedSp = recent.reduce(
    (sum, sprint) => sum + sprint.completedDevelopmentSp,
    0,
  );
  const totalActualDevDays = recent.reduce(
    (sum, sprint) => sum + sprint.actualDevelopmentDays,
    0,
  );
  const result =
    totalActualDevDays > 0
      ? resolved(
          totalCompletedSp / totalActualDevDays,
          recent.length === 4 ? 'rolling_4_sprint' : 'rolling_partial',
        )
      : resolved(
          seedValue ?? null,
          seedValue == null ? 'unset' : 'manual_seed',
        );

  return recent.length === 0
    ? result
    : {
        ...result,
        sprintCountUsed: recent.length,
        totalCompletedSp,
        totalActualDevDays,
      };
}
