import {
  computeTeamIterationSchedule,
  isWeekday,
  type TeamIterationSchedule,
} from '../organization/cadence';
import { resolveEffectiveLocationHolidays } from '../organization/holidays';
import { contributesToDevCapacity } from '../organization/roles';
import {
  aggregatePiCategoryBudgets,
  calculateSprintCategoryBudgets,
} from './budgets';
import { calculateLoad } from './load';
import type {
  CapacityEngineInput,
  DeductionMode,
  IterationCapacitySummary,
  MemberIterationAvailability,
  MemberIterationBreakdown,
  TeamPiCapacityView,
} from './types';
import { resolveNormalizedVelocity } from './velocity';

export function hoursToMinutes(hours: number) {
  return Math.round(hours * 60);
}

export function getWorkdayMinutes(hoursPerDay: number) {
  return hoursToMinutes(hoursPerDay);
}

export function hoursToDays(hours: number, hoursPerDay: number) {
  return hours / hoursPerDay;
}

export function snapToQuarterHour(hours: number) {
  return Math.floor(hours * 4 + 0.5) / 4;
}

export function computeBulkOverheadDeductionHours(
  mode: DeductionMode,
  value: number,
  hoursPerDay: number,
  availability: Pick<
    MemberIterationAvailability,
    'assignedWeekdays' | 'scheduledWeekdays' | 'availableMinutes'
  >,
) {
  if (availability.scheduledWeekdays === 0) return 0;
  const hours =
    mode === 'fixed_days'
      ? (value * hoursPerDay * availability.assignedWeekdays) /
        availability.scheduledWeekdays
      : (availability.availableMinutes * value) / 6000;
  return snapToQuarterHour(hours);
}

function scheduledWeekdays(schedule: TeamIterationSchedule) {
  const weekdays: string[] = [];
  const day = new Date(`${schedule.scheduledStartDate}T00:00:00Z`);
  const end = Date.parse(`${schedule.scheduledEndDate}T00:00:00Z`);
  while (day.getTime() <= end) {
    const iso = day.toISOString().slice(0, 10);
    if (isWeekday(iso)) weekdays.push(iso);
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return weekdays;
}

type Member = CapacityEngineInput['members'][number];
type AvailabilityInput = Pick<
  CapacityEngineInput,
  'assignments' | 'holidays' | 'absences'
> & {
  member: Pick<Member, 'memberId' | 'location'>;
  schedule: TeamIterationSchedule;
  hoursPerDay: number;
};

export function calculateMemberIterationAvailability({
  member,
  schedule,
  hoursPerDay,
  assignments,
  holidays,
  absences,
}: AvailabilityInput): MemberIterationAvailability {
  const workdayMinutes = getWorkdayMinutes(hoursPerDay);
  const days = scheduledWeekdays(schedule);
  const memberAssignments = assignments.filter(
    ({ memberId, teamId }) =>
      memberId === member.memberId && teamId === schedule.teamId,
  );
  const assigned = days.filter((day) =>
    memberAssignments.some(
      ({ startDate, endDate }) =>
        startDate <= day && (endDate === null || day <= endDate),
    ),
  );
  const assignedSet = new Set(assigned);
  const effectiveHolidays = resolveEffectiveLocationHolidays(
    holidays.filter(
      ({ locationId, date }) =>
        locationId === member.location.id && assignedSet.has(date),
    ),
  ).map((holiday) => ({ ...holiday, isEstimated: !holiday.confirmed }));
  const activeAbsences = absences.filter(
    ({ memberId, date, status, affectsCapacity }) =>
      memberId === member.memberId &&
      assignedSet.has(date) &&
      status === 'active' &&
      affectsCapacity,
  );
  let holidayMinutes = 0;
  let absenceMinutes = 0;
  for (const day of assigned) {
    const holiday = effectiveHolidays.filter(({ date }) => date === day);
    const holidayFraction = holiday.some(({ portion }) => portion === 'full')
      ? 1
      : holiday.length
        ? 0.5
        : 0;
    const portions = new Set(
      activeAbsences
        .filter(({ date }) => date === day)
        .map(({ portion }) => portion),
    );
    const absenceFraction = portions.has('full') ? 1 : portions.size * 0.5;
    holidayMinutes += holidayFraction * workdayMinutes;
    absenceMinutes +=
      Math.min(absenceFraction, 1 - holidayFraction) * workdayMinutes;
  }
  const workingMinutes = assigned.length * workdayMinutes - holidayMinutes;
  const availableMinutes = workingMinutes - absenceMinutes;
  return {
    scheduledWeekdays: days.length,
    assignedWeekdays: assigned.length,
    scheduledMinutes: assigned.length * workdayMinutes,
    workingMinutes,
    holidayMinutes,
    absenceMinutes,
    availableMinutes,
    workingDaysRaw: workingMinutes / workdayMinutes,
    holidayDaysRaw: holidayMinutes / workdayMinutes,
    absenceDaysRaw: absenceMinutes / workdayMinutes,
    availableDaysRaw: availableMinutes / workdayMinutes,
    holidays: effectiveHolidays,
    absences: activeAbsences,
    hasEstimatedHoliday: effectiveHolidays.some(
      ({ isEstimated }) => isEstimated,
    ),
  };
}

function sum<T>(values: readonly T[], valueOf: (value: T) => number) {
  return values.reduce((total, value) => total + valueOf(value), 0);
}

function sumKnown(values: readonly (number | null)[]) {
  return values.length === 0 || values.some((value) => value === null)
    ? null
    : sum(values, (value) => value ?? 0);
}

function displayDays(days: number) {
  return Math.round(days * 10) / 10;
}

function makeMemberCell(
  input: CapacityEngineInput,
  member: Member,
  schedule: TeamIterationSchedule,
): MemberIterationBreakdown {
  const { team, today } = input;
  const availability = calculateMemberIterationAvailability({
    ...input,
    member,
    schedule,
    hoursPerDay: team.hoursPerDay,
  });
  const exclusionReason =
    availability.assignedWeekdays === 0
      ? 'unassigned'
      : !contributesToDevCapacity(member.role)
        ? 'role'
        : member.recordStatus === 'archived' &&
            schedule.scheduledEndDate >= today
          ? 'archived'
          : null;
  const overheadDeductions =
    exclusionReason === null
      ? input.overheadDeductions
          .filter(
            (row) =>
              row.teamId === team.id &&
              row.memberId === member.memberId &&
              row.iterationId === schedule.iterationId,
          )
          .map(({ categoryId, deductedHours, source }) => ({
            categoryId,
            deductedHours,
            source,
            daysRaw: hoursToDays(deductedHours, team.hoursPerDay),
          }))
      : [];
  const overheadMinutes = sum(overheadDeductions, ({ deductedHours }) =>
    hoursToMinutes(deductedHours),
  );
  const remainingMinutes = availability.availableMinutes - overheadMinutes;
  const hasOverDeductedWarning =
    exclusionReason === null && remainingMinutes < 0;
  const preFteMinutes =
    exclusionReason === null ? Math.max(0, remainingMinutes) : 0;
  const devDaysRaw =
    (preFteMinutes * member.fteFactor) / getWorkdayMinutes(team.hoursPerDay);
  return {
    ...availability,
    iterationId: schedule.iterationId,
    exclusionReason,
    overheadDeductions,
    overheadMinutes,
    overheadDaysRaw: hoursToDays(overheadMinutes / 60, team.hoursPerDay),
    preFteMinutes,
    devDaysRaw,
    devHours: devDaysRaw * team.hoursPerDay,
    devMinutes: hoursToMinutes(devDaysRaw * team.hoursPerDay),
    hasOverDeductedWarning,
    warnings: hasOverDeductedWarning ? ['over_deducted'] : [],
  };
}

export function calculateTeamPiCapacity(
  input: CapacityEngineInput,
): TeamPiCapacityView {
  const { team, pi, today } = input;
  const schedules = input.iterations
    .filter((iteration) => iteration.piId === pi.id)
    .map((iteration) =>
      computeTeamIterationSchedule(
        iteration,
        team.id,
        team.sprintOffsetWorkdays,
      ),
    )
    .sort(
      (a, b) =>
        a.scheduledStartDate.localeCompare(b.scheduledStartDate) ||
        a.iterationId.localeCompare(b.iterationId),
    );
  const velocityInputs = {
    piOverride: input.piVelocityOverride,
    completedSprints: input.completedSprintHistory ?? [],
    seedValue: team.seedNormalizedVelocity,
  };
  const velocity = resolveNormalizedVelocity(velocityInputs);
  const assigned = input.members
    .map((member) => ({
      member,
      cells: schedules.map((schedule) =>
        makeMemberCell(input, member, schedule),
      ),
    }))
    .filter(({ member, cells }) =>
      cells.length > 0
        ? cells.some(({ assignedWeekdays }) => assignedWeekdays > 0)
        : input.assignments.some(
            ({ memberId, teamId, startDate, endDate }) =>
              memberId === member.memberId &&
              teamId === team.id &&
              startDate <= today &&
              (endDate === null || today <= endDate),
          ),
    );
  const members: TeamPiCapacityView['members'] = [];
  const excludedMembers: TeamPiCapacityView['excludedMembers'] = [];
  for (const { member, cells } of assigned) {
    const roleEligible = contributesToDevCapacity(member.role);
    const eligible = cells.filter(
      ({ exclusionReason }) => exclusionReason === null,
    );
    const include = cells.length
      ? eligible.length > 0
      : roleEligible && member.recordStatus === 'active';
    const excludedIterationIds = cells
      .filter(
        ({ exclusionReason }) =>
          exclusionReason === 'role' || exclusionReason === 'archived',
      )
      .map(({ iterationId }) => iterationId);
    if (!include || excludedIterationIds.length > 0) {
      excludedMembers.push({
        memberId: member.memberId,
        fullName: member.fullName,
        initials: member.initials,
        role: member.role,
        locationCode: member.location.code,
        exclusionReason: roleEligible ? 'archived' : 'role',
        excludedIterationIds,
      });
    }
    if (!include) continue;
    members.push({
      ...member,
      cells,
      piDevDaysRaw: sum(eligible, (cell) => cell.devDaysRaw),
      piDevHours: sum(eligible, (cell) => cell.devHours),
      piWorkingDaysRaw: sum(eligible, (cell) => cell.workingDaysRaw),
      piHolidayDaysRaw: sum(eligible, (cell) => cell.holidayDaysRaw),
      piAbsenceDaysRaw: sum(eligible, (cell) => cell.absenceDaysRaw),
      piOverheadDaysRaw: sum(eligible, (cell) => cell.overheadDaysRaw),
    });
  }

  const categoryOrder = [...input.overheadCategories].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder || a.categoryId.localeCompare(b.categoryId),
  );
  const iterations = schedules.map<IterationCapacitySummary>(
    (schedule, index) => {
      const { iterationId, scheduledStartDate, scheduledEndDate } = schedule;
      const weekdayCount = scheduledWeekdays(schedule).length;
      const eligible = members
        .map((member) => ({ member, cell: member.cells[index]! }))
        .filter(({ cell }) => cell.exclusionReason === null);
      const sprintOverride = input.sprintVelocityOverrides?.get(iterationId);
      const sprintVelocity =
        sprintOverride == null
          ? velocity
          : resolveNormalizedVelocity({ ...velocityInputs, sprintOverride });
      const teamDevDaysRaw = sum(eligible, ({ cell }) => cell.devDaysRaw);
      const forecastSpRaw =
        sprintVelocity.value === null
          ? null
          : teamDevDaysRaw * sprintVelocity.value;
      const forecastSpDisplay =
        forecastSpRaw === null ? null : Math.round(forecastSpRaw);
      const plannedSp = input.plannedSpByIteration?.get(iterationId) ?? null;
      const holidayLocations = new Map<
        string,
        IterationCapacitySummary['holidayLocations'][number]
      >();
      const hoursByCategory = new Map<string, number>();
      for (const { member, cell } of eligible) {
        if (cell.holidays.length) {
          const { location } = member;
          holidayLocations.set(location.id, {
            ...location,
            isEstimated:
              cell.hasEstimatedHoliday ||
              (holidayLocations.get(location.id)?.isEstimated ?? false),
          });
        }
        for (const { categoryId, deductedHours } of cell.overheadDeductions) {
          hoursByCategory.set(
            categoryId,
            (hoursByCategory.get(categoryId) ?? 0) + deductedHours,
          );
        }
      }
      return {
        ...schedule,
        scheduledWeekdays: weekdayCount,
        isCurrent: scheduledStartDate <= today && today <= scheduledEndDate,
        eligibleFte:
          weekdayCount === 0
            ? 0
            : sum(
                eligible,
                ({ member, cell }) => member.fteFactor * cell.assignedWeekdays,
              ) / weekdayCount,
        holidayLocations: [...holidayLocations.values()],
        teamDevDaysRaw,
        teamDevDaysDisplay: displayDays(teamDevDaysRaw),
        teamDevHours: sum(eligible, ({ cell }) => cell.devHours),
        teamAvailableDaysRaw: sum(
          eligible,
          ({ cell }) => cell.availableDaysRaw,
        ),
        teamAbsenceDaysRaw: sum(eligible, ({ cell }) => cell.absenceDaysRaw),
        overheadByCategory: categoryOrder.map(({ categoryId }) => {
          const hours = hoursByCategory.get(categoryId) ?? 0;
          return {
            categoryId,
            hours,
            daysRaw: hoursToDays(hours, team.hoursPerDay),
          };
        }),
        velocity: sprintVelocity,
        forecastSpRaw,
        forecastSpDisplay,
        plannedSp,
        load:
          plannedSp === null || forecastSpDisplay === null
            ? null
            : calculateLoad(plannedSp, forecastSpDisplay),
      };
    },
  );

  const overheadCategories = categoryOrder.map((category, index) => {
    const byIteration = iterations.map(
      ({ iterationId, overheadByCategory }) => {
        const { hours, daysRaw } = overheadByCategory[index]!;
        return { iterationId, hours, daysRaw };
      },
    );
    const piTotalHours = sum(byIteration, ({ hours }) => hours);
    return {
      ...category,
      piTotalHours,
      piTotalDaysRaw: hoursToDays(piTotalHours, team.hoursPerDay),
      byIteration,
    };
  });
  const sprintBudgets = iterations.map(({ forecastSpDisplay, forecastSpRaw }) =>
    calculateSprintCategoryBudgets(
      forecastSpDisplay,
      forecastSpRaw,
      input.allocation,
    ),
  );
  const piBudgets = aggregatePiCategoryBudgets(sprintBudgets);
  const { items, ...allocation } = input.allocation;
  const rows = items.map((category) => {
    const piBudget = piBudgets?.find(
      ({ categoryId }) => categoryId === category.categoryId,
    );
    const planned = input.plannedSpByCategoryAndIteration?.get(
      category.categoryId,
    );
    const byIteration = iterations.map(({ iterationId }, index) => {
      const budget = sprintBudgets[index]?.find(
        ({ categoryId }) => categoryId === category.categoryId,
      );
      const plannedSp = planned?.get(iterationId) ?? null;
      const budgetSpDisplay = budget?.budgetSpDisplay ?? null;
      return {
        iterationId,
        plannedSp,
        budgetSpRaw: budget?.budgetSpRaw ?? null,
        budgetSpDisplay,
        load:
          plannedSp === null || budgetSpDisplay === null
            ? null
            : calculateLoad(plannedSp, budgetSpDisplay),
      };
    });
    return {
      ...category,
      byIteration,
      piBudgetSpRaw: piBudget?.budgetSpRaw ?? null,
      piBudgetSpDisplay: piBudget?.budgetSpDisplay ?? null,
      piPlannedSp: sumKnown(byIteration.map(({ plannedSp }) => plannedSp)),
    };
  });
  const plannedSp = sumKnown(
    iterations.map((iteration) => iteration.plannedSp),
  );
  const piDevDaysRaw = sum(iterations, (iteration) => iteration.teamDevDaysRaw);
  const piWeekdays = sum(
    iterations,
    (iteration) => iteration.scheduledWeekdays,
  );
  return {
    team,
    pi,
    velocity,
    iterations,
    members,
    excludedMembers,
    overheadCategories,
    allocation: { ...allocation, rows },
    readOnly:
      team.recordStatus === 'archived' ||
      team.trainRecordStatus === 'archived' ||
      pi.recordStatus === 'archived',
    kpi: {
      plannedSp,
      plannedSpStatus: plannedSp === null ? 'not_yet_available' : 'available',
      piDevDaysRaw,
      piDevDaysDisplay: displayDays(piDevDaysRaw),
      piDevHours: sum(iterations, (iteration) => iteration.teamDevHours),
      piForecastSpRaw: sumKnown(
        iterations.map((iteration) => iteration.forecastSpRaw),
      ),
      piForecastSpDisplay: sumKnown(
        iterations.map((iteration) => iteration.forecastSpDisplay),
      ),
      eligibleFte:
        piWeekdays === 0
          ? sum(members, (member) => member.fteFactor)
          : sum(
              iterations,
              ({ scheduledWeekdays, eligibleFte }) =>
                scheduledWeekdays * eligibleFte,
            ) / piWeekdays,
      eligibleMemberCount: members.length,
      totalAssignedMemberCount: assigned.length,
      excludedMemberCount: assigned.length - members.length,
    },
  };
}
