import { expect, it } from 'vitest';
import { calculateLoad } from '@/domain/capacity/load';
import {
  calculateTeamPiCapacity,
  computeBulkOverheadDeductionHours,
  getWorkdayMinutes,
  snapToQuarterHour,
} from '@/domain/capacity/engine';
import { resolveNormalizedVelocity } from '@/domain/capacity/velocity';
import {
  BulkApplyOverheadDeductionsSchema,
  CapacityViewQuerySchema,
  DeleteTeamPiVelocityOverrideQuerySchema,
  SetTeamPiVelocityOverrideSchema,
  UpdateTeamCapacitySettingsSchema,
  UpsertOverheadDeductionSchema,
} from '@/domain/capacity/schemas';
import { calculateSprintCategoryBudgets } from '@/domain/capacity/budgets';
import type {
  CapacityEngineInput,
  CompletedSprintHistoryEntry,
} from '@/domain/capacity/types';
import { capacityGoldenFixture } from '../support/capacity-golden-fixture';

it('uses inclusive load thresholds and handles zero forecasts', () => {
  expect([84, 85, 115, 116].map((sp) => calculateLoad(sp, 100).band)).toEqual([
    'amber',
    'green',
    'green',
    'red',
  ]);
  expect(calculateLoad(0, 0)).toMatchObject({ band: 'none', loadPct: null });
  expect(calculateLoad(1, 0)).toMatchObject({ band: 'red', loadPct: null });
});

it('preserves zero velocity and snaps hour ties upward', () => {
  expect(
    resolveNormalizedVelocity({
      sprintOverride: 0,
      piOverride: 1,
      completedSprints: [],
      seedValue: 2,
    }),
  ).toMatchObject({ source: 'sprint_override', value: 0 });
  expect([0.125, 0.8, 3.2, 4.8].map(snapToQuarterHour)).toEqual([
    0.25, 0.75, 3.25, 4.75,
  ]);
});

it('rejects invalid workday values and injected actor fields', () => {
  const teamId = '00000000-0000-4000-8000-000000000001';
  for (const hoursPerDay of [0.001, 7.25, 25, NaN, Infinity]) {
    expect(
      UpdateTeamCapacitySettingsSchema.safeParse({ teamId, hoursPerDay })
        .success,
    ).toBe(false);
  }
  expect(
    UpdateTeamCapacitySettingsSchema.safeParse({ teamId, hoursPerDay: 7.5 })
      .success,
  ).toBe(true);
  expect(
    UpdateTeamCapacitySettingsSchema.safeParse({
      teamId,
      createdBy: 'local:sm',
    }).success,
  ).toBe(false);
});

it('validates all capacity commands at their input boundaries', () => {
  const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
  const query = { teamId: id(1), piId: id(2) };
  for (const schema of [
    CapacityViewQuerySchema,
    DeleteTeamPiVelocityOverrideQuerySchema,
  ]) {
    expect(schema.safeParse(query).success).toBe(true);
    expect(schema.safeParse({ ...query, piId: 'pi' }).success).toBe(false);
    expect(schema.safeParse({ ...query, actor: 'local:sm' }).success).toBe(
      false,
    );
  }
  for (const velocity of [0, 1000]) {
    expect(
      SetTeamPiVelocityOverrideSchema.safeParse({ ...query, velocity }).success,
    ).toBe(true);
  }
  for (const velocity of [-1, 1001, Infinity]) {
    expect(
      SetTeamPiVelocityOverrideSchema.safeParse({ ...query, velocity }).success,
    ).toBe(false);
    expect(
      UpdateTeamCapacitySettingsSchema.safeParse({
        teamId: id(1),
        seedNormalizedVelocity: velocity,
      }).success,
    ).toBe(false);
  }
  expect(
    UpdateTeamCapacitySettingsSchema.safeParse({ teamId: id(1) }).success,
  ).toBe(false);
  expect(
    UpdateTeamCapacitySettingsSchema.safeParse({
      teamId: id(1),
      seedNormalizedVelocity: null,
    }).success,
  ).toBe(true);
  const single = {
    teamId: id(1),
    memberId: id(2),
    iterationId: id(3),
    categoryId: id(4),
  };
  for (const hours of [0, 0.25, 744]) {
    expect(
      UpsertOverheadDeductionSchema.safeParse({
        ...single,
        deductedHours: hours,
      }).success,
    ).toBe(true);
  }
  for (const hours of [-1, 0.1, 744.25]) {
    expect(
      UpsertOverheadDeductionSchema.safeParse({
        ...single,
        deductedHours: hours,
      }).success,
    ).toBe(false);
  }
  for (const [mode, max] of [
    ['fixed_days', 31],
    ['percent', 100],
  ] as const) {
    const entry = { categoryId: id(4), value: max };
    const apply = (entries: unknown[]) =>
      BulkApplyOverheadDeductionsSchema.safeParse({ ...query, mode, entries })
        .success;
    expect(apply([entry])).toBe(true);
    expect(apply([])).toBe(false);
    expect(apply([entry, entry])).toBe(false);
    expect(apply([{ ...entry, value: max + 1 }])).toBe(false);
    expect(apply([{ ...entry, createdBy: 'local:sm' }])).toBe(false);
  }
});

function singleSprint(): CapacityEngineInput {
  const input = capacityGoldenFixture();
  return {
    ...input,
    iterations: input.iterations.slice(0, 1),
    holidays: [],
    absences: [],
    overheadDeductions: [],
    members: input.members.slice(0, 1),
    assignments: input.assignments.slice(0, 1),
  };
}

it.each([-1, 1] as const)(
  'uses the Team weekday offset %i and clips to inclusive assignment dates',
  (offset) => {
    const input = singleSprint();
    input.team.sprintOffsetWorkdays = offset;
    input.assignments = [
      {
        ...input.assignments[0]!,
        startDate: '2027-01-05',
        endDate: '2027-01-08',
      },
    ];
    const result = calculateTeamPiCapacity(input);
    expect(result.iterations[0]!).toMatchObject({
      scheduledStartDate: offset < 0 ? '2027-01-01' : '2027-01-05',
      scheduledEndDate: offset < 0 ? '2027-01-14' : '2027-01-18',
      eligibleFte: 0.4,
    });
    expect(result.members[0]!.cells[0]!.assignedWeekdays).toBe(4);
  },
);

it.each([
  [['am', 'am'], 0, 0.5],
  [['pm', 'pm'], 0, 0.5],
  [['am', 'pm'], 0, 1],
  [['am', 'am'], 0.5, 0.5],
  [['pm', 'pm'], 0.5, 0.5],
  [['am', 'pm'], 0.5, 0.5],
  [['full'], 1, 0],
  [['full'], 0.5, 0.5],
] as const)(
  'deduplicates portions %j and caps overlap with a %s-day holiday',
  (portions, holidayDays, absenceDays) => {
    const input = singleSprint();
    input.team.hoursPerDay = 7.5;
    const member = input.members[0]!;
    const date = '2027-01-06';
    const holiday = {
      id: 'local',
      locationId: member.location.id,
      date,
      name: 'Local holiday',
      portion: 'full',
      source: 'library',
      confirmed: true,
    } as const;
    input.holidays = [
      { ...holiday, id: 'other', locationId: 'SG' },
      { ...holiday, id: 'weekend', date: '2027-01-09' },
      ...(holidayDays
        ? [
            holiday,
            {
              ...holiday,
              id: 'estimate',
              source: 'manual' as const,
              portion:
                holidayDays === 1 ? ('full' as const) : ('half' as const),
              confirmed: false,
            },
          ]
        : []),
    ];
    const absence = {
      memberId: member.memberId,
      date,
      name: 'Leave',
      status: 'active',
      affectsCapacity: true,
    } as const;
    input.absences = [
      ...portions.map((portion, index) => ({
        ...absence,
        id: String(index),
        portion,
      })),
      { ...absence, id: 'weekend', date: '2027-01-09', portion: 'full' },
      {
        ...absence,
        id: 'cancelled',
        date: '2027-01-07',
        portion: 'full',
        status: 'cancelled',
      },
      {
        ...absence,
        id: 'travel',
        date: '2027-01-08',
        portion: 'full',
        affectsCapacity: false,
      },
    ];
    expect(calculateTeamPiCapacity(input).members[0]!.cells[0]!).toMatchObject({
      holidayDaysRaw: holidayDays,
      absenceDaysRaw: absenceDays,
      availableMinutes: (10 - holidayDays - absenceDays) * 450,
      hasEstimatedHoliday: holidayDays > 0,
      holidays: holidayDays
        ? [expect.objectContaining({ id: 'estimate' })]
        : [],
      absences: portions.map((_, id) =>
        expect.objectContaining({ id: String(id) }),
      ),
    });
  },
);

it('keeps transfer deductions team-scoped and applies FTE after overhead', () => {
  const input = singleSprint();
  const member = input.members[0]!;
  member.fteFactor = 0.33;
  const assignment = input.assignments[0]!;
  input.assignments = [
    { ...assignment, endDate: '2027-01-07' },
    { ...assignment, teamId: 'cebu', startDate: '2027-01-08' },
  ];
  const scope = {
    memberId: member.memberId,
    iterationId: '2702',
    categoryId: 'gw',
    source: 'pi_plan',
  } as const;
  input.overheadDeductions = [
    { ...scope, teamId: input.team.id, deductedHours: 3.25 },
    { ...scope, teamId: 'cebu', deductedHours: 4.75 },
  ];
  const palawan = calculateTeamPiCapacity(input);
  const palawanCell = palawan.members[0]!.cells[0]!;
  expect(palawanCell).toMatchObject({
    assignedWeekdays: 4,
    overheadMinutes: 195,
    devMinutes: 569,
  });
  expect(palawanCell.devDaysRaw).toBe(((1920 - 195) * 0.33) / 480);
  expect(palawanCell.devHours).toBeCloseTo(9.4875, 10);
  expect(palawan.kpi.eligibleFte).toBeCloseTo(0.132, 10);
  const cebuCell = calculateTeamPiCapacity({
    ...input,
    team: { ...input.team, id: 'cebu' },
  }).members[0]!.cells[0]!;
  expect(cebuCell).toMatchObject({ assignedWeekdays: 6, overheadMinutes: 285 });
  expect(
    computeBulkOverheadDeductionHours('fixed_days', 1, 8, palawanCell),
  ).toBe(3.25);
  expect(computeBulkOverheadDeductionHours('fixed_days', 1, 8, cebuCell)).toBe(
    4.75,
  );
  expect(computeBulkOverheadDeductionHours('percent', 15, 8, palawanCell)).toBe(
    4.75,
  );
});

it('preserves stored hours across workday changes and clamps over-deductions', () => {
  const input = singleSprint();
  input.overheadDeductions = [
    {
      memberId: input.members[0]!.memberId,
      iterationId: '2702',
      teamId: input.team.id,
      categoryId: 'gw',
      deductedHours: 8,
      source: 'pi_plan',
    },
  ];
  input.team.hoursPerDay = 7.5;
  let result = calculateTeamPiCapacity(input);
  expect(result.overheadCategories[0]!.piTotalHours).toBe(8);
  expect(result.members[0]!.cells[0]!.overheadDaysRaw).toBe(8 / 7.5);
  expect(result.members[0]!.cells[0]!.devHours).toBeCloseTo(67);
  input.team.hoursPerDay = 1;
  input.overheadDeductions = [
    { ...input.overheadDeductions[0]!, deductedHours: 11 },
  ];
  result = calculateTeamPiCapacity(input);
  expect(result.members[0]!.cells[0]!).toMatchObject({
    devDaysRaw: 0,
    devMinutes: 0,
    warnings: ['over_deducted'],
  });
  expect([1, 7.5, 8, 24].map(getWorkdayMinutes)).toEqual([60, 450, 480, 1440]);
});

it('includes archived members only in past team-scheduled iterations', () => {
  const input = capacityGoldenFixture();
  input.members = [{ ...input.members[0]!, recordStatus: 'archived' }];
  input.today = '2027-02-12';
  const result = calculateTeamPiCapacity(input);
  expect(
    result.members[0]!.cells.map(({ exclusionReason }) => exclusionReason),
  ).toEqual([null, null, 'archived', 'archived', 'archived']);
  expect(result.excludedMembers).toMatchObject([
    {
      memberId: input.members[0]!.memberId,
      exclusionReason: 'archived',
      excludedIterationIds: ['2706', '2708', '2710'],
    },
  ]);
  expect(result.kpi).toMatchObject({
    eligibleFte: 0.4,
    eligibleMemberCount: 1,
    excludedMemberCount: 0,
    totalAssignedMemberCount: 1,
  });
  const futureOnly = calculateTeamPiCapacity({
    ...input,
    iterations: input.iterations.slice(2),
  });
  expect(futureOnly.excludedMembers).toEqual(result.excludedMembers);
  expect(futureOnly.kpi).toMatchObject({
    eligibleFte: 0,
    eligibleMemberCount: 0,
    excludedMemberCount: 1,
    totalAssignedMemberCount: 1,
  });
});

it('discloses archived exclusions only where the member had assigned weekdays', () => {
  const input = capacityGoldenFixture();
  input.members = [{ ...input.members[0]!, recordStatus: 'archived' }];
  input.assignments = [{ ...input.assignments[0]!, endDate: '2027-02-05' }];
  const result = calculateTeamPiCapacity(input);
  expect(result.excludedMembers).toMatchObject([
    { exclusionReason: 'archived', excludedIterationIds: ['2706'] },
  ]);
  expect(
    result.members[0]!.cells.map(({ exclusionReason }) => exclusionReason),
  ).toEqual([null, null, 'archived', 'unassigned', 'unassigned']);
});

it.each(['Admin', 'RTE', 'SM', 'PO'] as const)(
  'excludes assigned %s members from capacity and reports their role',
  (role) => {
    const input = singleSprint();
    input.members = [{ ...input.members[0]!, role }];
    const result = calculateTeamPiCapacity(input);
    expect(result.members).toEqual([]);
    expect(result.excludedMembers).toMatchObject([
      { role, exclusionReason: 'role', excludedIterationIds: ['2702'] },
    ]);
    expect(result.kpi).toMatchObject({
      piDevDaysRaw: 0,
      piForecastSpDisplay: 0,
      eligibleFte: 0,
      excludedMemberCount: 1,
    });
  },
);

it('computes displayed load from displayed forecast and category budget SP', () => {
  const input = capacityGoldenFixture();
  input.piVelocityOverride = 39.75 / 60.75;
  input.plannedSpByIteration = new Map([['2702', 46]]);
  input.plannedSpByCategoryAndIteration = new Map([
    ['dev-0', new Map([['2702', 22]])],
  ]);
  const result = calculateTeamPiCapacity(input);
  expect(result.iterations[0]).toMatchObject({
    forecastSpDisplay: 40,
    load: { forecastSp: 40, loadPct: 115, band: 'green' },
  });
  expect(result.iterations[0]!.forecastSpRaw).toBeCloseTo(39.75);
  expect(result.allocation.rows[0]!.byIteration[0]).toMatchObject({
    budgetSpDisplay: 22,
    load: { forecastSp: 22, loadPct: 100, band: 'green' },
  });
  expect(result.allocation.rows[0]!.byIteration[0]!.budgetSpRaw).toBeCloseTo(
    22.26,
  );
});

it('applies the zero-forecast load rule when a positive raw forecast displays as zero', () => {
  const input = singleSprint();
  input.team.seedNormalizedVelocity = 0.04;
  input.plannedSpByIteration = new Map([['2702', 1]]);
  const result = calculateTeamPiCapacity(input);
  expect(result.iterations[0]).toMatchObject({
    forecastSpRaw: 0.4,
    forecastSpDisplay: 0,
    load: { forecastSp: 0, loadPct: null, band: 'red' },
  });
});

it('weights PI FTE by scheduled weekdays and falls back to current roster without iterations', () => {
  const input = singleSprint();
  input.iterations = [
    ...input.iterations,
    {
      ...input.iterations[0]!,
      id: 'short',
      startDate: '2027-01-18',
      endDate: '2027-01-22',
    },
  ];
  input.assignments = [{ ...input.assignments[0]!, endDate: '2027-01-15' }];
  expect(calculateTeamPiCapacity(input).kpi.eligibleFte).toBe(10 / 15);
  expect(
    calculateTeamPiCapacity({ ...input, today: '2027-01-15', iterations: [] })
      .kpi.eligibleFte,
  ).toBe(1);
});

it('resolves rolling velocity by recency and ratio of sums, including IP', () => {
  const history: CompletedSprintHistoryEntry[] = [1, 2, 3, 4, 5].map((day) => ({
    iterationId: String(day),
    endDate: `2027-02-0${day}`,
    kind: day === 5 ? 'ip' : 'development',
    completedDevelopmentSp: day === 1 ? 100 : day * 2,
    actualDevelopmentDays: day + 1,
  }));
  const inputs = { completedSprints: history, seedValue: 9 };
  expect(resolveNormalizedVelocity(inputs)).toMatchObject({
    source: 'rolling_4_sprint',
    value: 28 / 18,
    sprintCountUsed: 4,
    totalCompletedSp: 28,
    totalActualDevDays: 18,
  });
  expect(resolveNormalizedVelocity({ ...inputs, piOverride: 0 })).toMatchObject(
    { value: 0, source: 'pi_override' },
  );
  const last = history[4]!;
  expect(
    resolveNormalizedVelocity({
      ...inputs,
      completedSprints: [{ ...last, completedDevelopmentSp: 0 }],
    }),
  ).toMatchObject({ value: 0, source: 'rolling_partial' });
  expect(
    resolveNormalizedVelocity({
      ...inputs,
      completedSprints: [{ ...last, actualDevelopmentDays: 0 }],
    }),
  ).toMatchObject({ value: 9, source: 'manual_seed' });
  expect(resolveNormalizedVelocity({ completedSprints: [] })).toMatchObject({
    value: null,
    source: 'unset',
  });
});

it('breaks exact budget ties by category order then ID and suppresses invalid splits', () => {
  const { allocation } = singleSprint();
  const base = allocation.items[0]!;
  allocation.items = [
    { ...base, categoryId: 'z', sortOrder: 0, effectivePct: 25 },
    { ...base, categoryId: 'b', sortOrder: 0, effectivePct: 25 },
    { ...base, categoryId: 'a', sortOrder: 1, effectivePct: 25 },
    { ...base, categoryId: 'd', sortOrder: 1, effectivePct: 25 },
  ];
  expect(calculateSprintCategoryBudgets(2, 2.1, allocation)).toEqual([
    { categoryId: 'z', budgetSpDisplay: 1, budgetSpRaw: 0.525 },
    { categoryId: 'b', budgetSpDisplay: 1, budgetSpRaw: 0.525 },
    { categoryId: 'a', budgetSpDisplay: 0, budgetSpRaw: 0.525 },
    { categoryId: 'd', budgetSpDisplay: 0, budgetSpRaw: 0.525 },
  ]);
  expect(
    calculateSprintCategoryBudgets(1, 1, allocation)?.[1]?.budgetSpDisplay,
  ).toBe(1);
  expect(
    calculateSprintCategoryBudgets(2, 2.1, { ...allocation, isValid: false }),
  ).toBeNull();
  expect(calculateSprintCategoryBudgets(null, null, allocation)).toBeNull();
});
