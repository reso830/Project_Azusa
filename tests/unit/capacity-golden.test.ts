import { expect, it } from 'vitest';
import { calculateTeamPiCapacity } from '@/domain/capacity/engine';
import { capacityGoldenFixture } from '../support/capacity-golden-fixture';

it('reproduces the baseline Palawan PI-2027.1 forecast and budgets', () => {
  const view = calculateTeamPiCapacity(capacityGoldenFixture());
  expect(view.iterations.map(({ teamDevDaysRaw }) => teamDevDaysRaw)).toEqual([
    60.75, 55.75, 59.75, 56.25, 58.75,
  ]);
  expect(
    view.iterations.map(({ forecastSpDisplay }) => forecastSpDisplay),
  ).toEqual([56, 51, 55, 52, 54]);
  expect(view.kpi).toMatchObject({
    piDevDaysRaw: 291.25,
    piDevDaysDisplay: 291.3,
    piForecastSpDisplay: 268,
    piDevHours: 2330,
    eligibleFte: 7.5,
    eligibleMemberCount: 8,
    excludedMemberCount: 2,
    plannedSp: null,
  });
  expect(view.kpi.piForecastSpRaw).toBeCloseTo(267.95, 10);
  expect(
    view.members.find(({ memberId }) => memberId === 'hana')?.cells[0]!
      .devDaysRaw,
  ).toBe(4.25);
  expect(view.iterations[0]!.overheadByCategory[0]!).toEqual({
    categoryId: 'gw',
    hours: 64,
    daysRaw: 8,
  });
  expect(
    view.allocation.rows.map(({ piBudgetSpDisplay }) => piBudgetSpDisplay),
  ).toEqual([149, 40, 38, 21, 20]);
  expect(
    view.iterations.map((_, index) =>
      view.allocation.rows.map(
        ({ byIteration }) => byIteration[index]!.budgetSpDisplay,
      ),
    ),
  ).toEqual([
    [31, 8, 8, 5, 4],
    [28, 8, 7, 4, 4],
    [31, 8, 8, 4, 4],
    [29, 8, 7, 4, 4],
    [30, 8, 8, 4, 4],
  ]);
  expect(view.iterations[4]!.holidayLocations).toContainEqual(
    expect.objectContaining({ code: 'SG', isEstimated: true }),
  );
});

it('distinguishes the individual adjustment from the baseline', () => {
  const view = calculateTeamPiCapacity(capacityGoldenFixture(true));
  expect(view.iterations[2]!).toMatchObject({
    teamDevDaysRaw: 60.25,
    teamDevDaysDisplay: 60.3,
    forecastSpDisplay: 55,
  });
  expect(view.kpi).toMatchObject({
    piDevDaysRaw: 291.75,
    piDevDaysDisplay: 291.8,
    piForecastSpDisplay: 268,
  });
  expect(view.kpi.piForecastSpRaw).toBeCloseTo(268.41, 10);
});
