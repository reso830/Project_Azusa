import AxeBuilder from '@axe-core/playwright';
import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';
import type { TeamPiCapacityView } from '../../src/domain/capacity/types';
import { getServerTodayIsoDate } from '../../src/domain/calendar/iso-week';
import { SAMPLE_CATEGORY_CATALOG } from '../../src/domain/categories/sample-catalog';
import { shiftWorkdays } from '../../src/domain/organization/cadence';
import {
  capacityBrowserIds as ids,
  prepareCapacityCatalog,
  setCapacityFixtureActive,
} from '../support/capacity-browser-fixture';

async function capacity(
  request: APIRequestContext,
  team = ids.team,
  pi = ids.pi,
): Promise<TeamPiCapacityView> {
  const response = await request.get(
    `/api/capacity?${new URLSearchParams({ teamId: team, piId: pi })}`,
  );
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

async function openCapacity(page: Page, team = ids.team, pi = ids.pi) {
  await page.goto(`/capacity?teamId=${team}&piId=${pi}`);
  await expect(
    page.getByRole('region', { name: 'Capacity summary' }),
  ).toBeVisible();
}

async function verifyAxe(page: Page) {
  const report = await new AxeBuilder({ page }).analyze();
  expect(
    report.violations.map(({ id, nodes }) => ({
      id,
      elements: nodes.map(({ target }) => target),
    })),
  ).toEqual([]);
}

test('prorates an API-scheduled transfer and shows both Team offsets', async ({
  page,
  request,
}) => {
  test.setTimeout(90_000);
  async function send(path: string, data: object, method = 'POST') {
    const response = await request.fetch(`/api/${path}`, { method, data });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  }
  const { id: trainId } = await send('organization/trains', {
    name: 'Capacity transfer ART',
  });
  try {
    const { id: from } = await send('organization/teams', {
      trainId,
      name: 'Transfer from',
    });
    const { id: to } = await send('organization/teams', {
      trainId,
      name: 'Transfer to',
    });
    const startDate = shiftWorkdays(getServerTodayIsoDate(), 1);
    const weekdays = [startDate];
    for (let day = startDate; weekdays.length < 10;) {
      day = shiftWorkdays(day, 1);
      weekdays.push(day);
    }
    const endDate = weekdays[9]!;
    const { id: pi } = await send('organization/pis', {
      trainId,
      name: 'Transfer PI',
      startDate,
      endDate,
    });
    await send(`organization/pis/${pi}/iterations`, {
      name: 'Transfer Sprint',
      kind: 'development',
      startDate,
      endDate,
    });
    const locations = await request.get('/api/organization/locations');
    expect(locations.ok(), await locations.text()).toBe(true);
    const [{ id: locationId }] = await locations.json();
    const { id: member } = await send('organization/members', {
      teamId: from,
      locationId,
      fullName: 'Transfer Member',
      initials: 'TM',
      role: 'Team member',
    });
    await send(
      `organization/members/${member}`,
      { teamId: to, effectiveDate: weekdays[4] },
      'PATCH',
    );
    const { categories } = await send('categories/sample', { trainId });
    const { id: categoryId } = categories.find(
      (category: { name: string }) => category.name === 'General work',
    );
    const deduction = async (team: string) => {
      const cell = (await capacity(request, team, pi)).members[0]?.cells[0];
      return {
        days: cell?.assignedWeekdays,
        hours:
          cell?.overheadDeductions.find((row) => row.categoryId === categoryId)
            ?.deductedHours ?? 0,
      };
    };
    for (const teamId of [from, to]) {
      await send('capacity/overhead-deductions/bulk', {
        teamId,
        piId: pi,
        mode: 'fixed_days',
        entries: [{ categoryId, value: 1 }],
      });
      expect(await deduction(from)).toEqual({ days: 4, hours: 3.25 });
      expect(await deduction(to)).toEqual({
        days: 6,
        hours: teamId === from ? 0 : 4.75,
      });
    }
    for (const [teamId, offset] of [
      [from, -1],
      [to, 1],
    ] as const) {
      await send(
        `organization/teams/${teamId}`,
        { sprintOffsetWorkdays: offset },
        'PATCH',
      );
      const [sprint] = (await capacity(request, teamId, pi)).iterations;
      expect(sprint).toMatchObject({
        scheduledStartDate: shiftWorkdays(startDate, offset),
        scheduledEndDate: shiftWorkdays(endDate, offset),
      });
      await openCapacity(page, teamId, pi);
      await page
        .getByRole('button', {
          name: /Inspect Transfer Member capacity for Transfer Sprint/,
        })
        .click();
      await expect(page.getByRole('dialog')).toContainText(
        `offset ${offset} workdays`,
      );
      await page.keyboard.press('Escape');
    }
  } finally {
    await send(
      `organization/trains/${trainId}`,
      { recordStatus: 'archived' },
      'PATCH',
    );
  }
});

async function expectGoldenPlan(
  view: TeamPiCapacityView,
  summary: Locator,
  memberTable: Locator,
  allocation: Locator,
  adjusted: boolean,
) {
  const sprintDays = [60.75, 55.75, adjusted ? 60.25 : 59.75, 56.25, 58.75];
  const forecasts = [56, 51, 55, 52, 54];
  const piBudgets = [149, 40, 38, 21, 20];
  const sprintBudgets = [
    [31, 8, 8, 5, 4],
    [28, 8, 7, 4, 4],
    [31, 8, 8, 4, 4],
    [29, 8, 7, 4, 4],
    [30, 8, 8, 4, 4],
  ];
  const piDays = adjusted ? 291.8 : 291.3;
  expect(view.kpi).toMatchObject({
    piDevDaysRaw: adjusted ? 291.75 : 291.25,
    piDevDaysDisplay: piDays,
    piForecastSpDisplay: 268,
  });
  expect(view.kpi.piForecastSpRaw).toBeCloseTo(adjusted ? 268.41 : 267.95, 10);
  expect(view.iterations.map(({ teamDevDaysRaw }) => teamDevDaysRaw)).toEqual(
    sprintDays,
  );
  expect(
    view.iterations.map(({ forecastSpDisplay }) => forecastSpDisplay),
  ).toEqual(forecasts);
  await expect(summary).toContainText(`${piDays} days`);
  await expect(
    summary.getByRole('button', { name: 'Inspect PI forecast' }),
  ).toHaveText('268 SP');
  await expect(
    memberTable
      .getByRole('row', { name: /^Team dev days/ })
      .locator('td strong'),
  ).toHaveText([
    String(piDays),
    ...sprintDays.map((days) => String(Math.round(days * 10) / 10)),
  ]);
  await expect(
    allocation.getByRole('row', { name: /^Forecast SP/ }).getByRole('button'),
  ).toHaveText([268, ...forecasts].map((forecast) => `${forecast} SP`));
  for (const [index, category] of SAMPLE_CATEGORY_CATALOG.filter(
    ({ kind }) => kind === 'development',
  ).entries()) {
    const row = allocation
      .getByRole('rowheader')
      .filter({ hasText: category.name })
      .locator('..');
    await expect(row.getByRole('cell')).toHaveText(
      [piBudgets[index], ...sprintBudgets.map((sprint) => sprint[index])].map(
        (budget) => `— / ${budget}`,
      ),
    );
  }
}

test('persists planner inputs, explains capacity, and keeps URL selection and access in sync', async ({
  page,
  request,
}) => {
  test.setTimeout(210000);
  const outside: string[] = [];
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://127.0.0.1:3100')
      return route.continue();
    outside.push(route.request().url());
    return route.abort();
  });
  await setCapacityFixtureActive(request, true);
  try {
    const { gw, training, development } = await prepareCapacityCatalog(request);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.clock.setFixedTime(new Date('2027-02-05T06:11:00.000Z'));
    await openCapacity(page);
    await expect(page).toHaveURL(/\/capacity$/);
    const summary = page.getByRole('region', { name: 'Capacity summary' });
    const context = page.getByRole('navigation', { name: 'Context' });
    const memberTable = page.getByRole('region', {
      name: 'Member capacity table',
    });
    const allocation = page.getByRole('region', {
      name: 'Team allocation matrix',
    });
    const velocity = page.getByRole('dialog', { name: 'Normalized velocity' });
    const editVelocity = () =>
      summary.getByRole('button', { name: 'Edit velocity' }).click();
    await expect(summary).toContainText('Not yet available');
    await expect(summary).toContainText('Unset');
    await expect(summary).toContainText('7.5 FTE');
    await summary.getByRole('button', { name: 'Excluded members (2)' }).click();
    await expect(page.getByText(/Maya Santos · SM/)).toBeVisible();
    await expect(page.getByText(/Pat Reyes · PO/)).toBeVisible();
    await page.keyboard.press('Escape');

    await editVelocity();
    const seed = velocity.getByLabel('Team velocity seed');
    const saveSeed = velocity.getByRole('button', { name: 'Save seed' });
    const saveError = 'The velocity update failed.';
    await page.route(
      '**/api/capacity/team-settings',
      (route) =>
        route.fulfill({ status: 503, json: { error: { message: saveError } } }),
      { times: 1 },
    );
    await seed.fill('0.92');
    await saveSeed.click();
    await expect(velocity.getByRole('alert')).toHaveText(saveError);
    await expect(page.getByText(saveError, { exact: true })).toHaveCount(1);
    await expect(saveSeed).toBeFocused();
    await velocity.getByLabel('Team velocity seed').fill('0.92');
    await saveSeed.click();
    await expect
      .poll(async () => (await capacity(request)).velocity.value)
      .toBe(0.92);
    await expect(summary).toContainText('Manual seed');
    await expect(saveSeed).toBeFocused();
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(summary).toContainText('Manual seed');
    await expect(allocation).toContainText('Total 100% ✓');
    await expect(
      summary.getByRole('button', { name: 'Inspect PI forecast' }),
    ).toBeVisible();

    const bulkApply = page.getByRole('button', { name: 'Bulk apply' });
    await page
      .getByRole('button', { name: 'Bulk overhead for General work' })
      .click();
    await bulkApply.click();
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'Enter at least one overhead deduction.' }),
    ).toBeVisible();
    await page.getByLabel('General work (days)', { exact: true }).fill('1');
    await page.getByLabel('Training (days)', { exact: true }).fill('0.5');
    await bulkApply.click();
    const stored = () => capacity(request);
    await expect
      .poll(
        async () =>
          (await stored()).overheadCategories.find(
            (row) => row.categoryId === gw,
          )?.byIteration[0]?.hours,
      )
      .toBe(64);
    await expectGoldenPlan(
      await stored(),
      summary,
      memberTable,
      allocation,
      false,
    );
    await expect(bulkApply).toBeFocused();
    await page.reload();
    await expect(
      page.getByRole('rowgroup', { name: 'Deducted first overhead' }),
    ).toContainText('64h');
    await memberTable
      .getByRole('button', { name: 'PI-2027.1', exact: true })
      .click();
    await expect(
      memberTable.getByRole('button', { name: 'PI-2027.1', exact: true }),
    ).toHaveAttribute('aria-expanded', 'true');
    await memberTable
      .getByRole('button', { name: '2706', exact: true })
      .click();
    await expect(
      memberTable.getByLabel(
        'General work deduction days for Hana Villanueva in 2706',
      ),
    ).toHaveValue('1');
    await expect(
      memberTable.getByLabel(
        'Training deduction days for Hana Villanueva in 2706',
      ),
    ).toHaveValue('0.5');
    await expect(
      memberTable.getByRole('button', {
        name: 'Inspect Hana Villanueva capacity for 2706',
      }),
    ).toHaveText('4.25');
    const carlo = () =>
      memberTable.getByLabel(
        'General work deduction days for Carlo Reyes in 2706',
      );
    const carloDev = memberTable.getByRole('button', {
      name: 'Inspect Carlo Reyes capacity for 2706',
    });
    const beforeEnter = await carloDev.innerText();
    await carlo().fill('0.5');
    await carlo().press('Enter');
    await expect
      .poll(
        async () =>
          (await stored()).members
            .find((row) => row.fullName === 'Carlo Reyes')
            ?.cells[2]?.overheadDeductions.find(
              (item) => item.categoryId === gw,
            )?.deductedHours,
      )
      .toBe(4);
    await expect(carloDev).not.toHaveText(beforeEnter);
    await expect(carlo()).toBeFocused();
    await expectGoldenPlan(
      await stored(),
      summary,
      memberTable,
      allocation,
      true,
    );
    const beforeTab = await carloDev.innerText();
    await carlo().fill('0.1');
    await carlo().press('Tab');
    await expect(carlo()).toHaveValue('0.09');
    await expect(carloDev).not.toHaveText(beforeTab);
    await expect(
      memberTable.getByLabel('Training deduction days for Carlo Reyes in 2706'),
    ).toBeFocused();
    await page.reload();
    await memberTable
      .getByRole('button', { name: '2706', exact: true })
      .click();
    await expect(carlo()).toHaveValue('0.09');

    const beforeHours = await stored();
    const openWorkday = () =>
      summary.getByRole('button', { name: /Edit hours per day/ }).click();
    const workday = page.getByRole('dialog', { name: 'Development capacity' });
    const hours = workday.getByLabel('Hours per day', { exact: true });
    await expect(hours).toBeHidden();
    await openWorkday();
    await verifyAxe(page);
    await hours.fill('7.5');
    await hours.press('Shift+Tab');
    await expect.poll(async () => (await stored()).team.hoursPerDay).toBe(7.5);
    await expect(
      workday.getByRole('button', { name: 'Close', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(carlo()).toHaveValue('0.1');
    await openWorkday();
    await hours.fill('8');
    await hours.press('Enter');
    await expect.poll(async () => (await stored()).team.hoursPerDay).toBe(8);
    await expect(hours).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(carlo()).toHaveValue('0.09');
    await openWorkday();
    await hours.fill('7.5');
    await hours.press('Enter');
    await expect.poll(async () => (await stored()).team.hoursPerDay).toBe(7.5);
    await page.keyboard.press('Escape');
    await expect(carlo()).toHaveValue('0.1');
    await page.reload();
    await openWorkday();
    await expect(hours).toHaveValue('7.5');
    await page.keyboard.press('Escape');
    const afterHours = await stored();
    expect(
      afterHours.overheadCategories.map((row) => row.piTotalHours),
    ).toEqual(beforeHours.overheadCategories.map((row) => row.piTotalHours));
    expect(afterHours.kpi.piDevDaysRaw).toBeLessThan(
      beforeHours.kpi.piDevDaysRaw,
    );

    await page
      .getByRole('button', { name: '% of available', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: '% of available', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page
      .getByRole('button', { name: 'Bulk overhead for General work' })
      .click();
    await page.getByLabel('General work (%)', { exact: true }).fill('10');
    await page.getByLabel('Training (%)', { exact: true }).fill('5');
    await page.getByRole('button', { name: 'Bulk apply' }).click();
    await expect
      .poll(
        async () =>
          (await stored()).overheadCategories.find(
            (row) => row.categoryId === gw,
          )?.piTotalHours,
      )
      .not.toBe(
        afterHours.overheadCategories.find((row) => row.categoryId === gw)
          ?.piTotalHours,
      );
    await page.reload();
    expect(
      (await stored()).members
        .flatMap((row) => row.cells)
        .flatMap((cell) => cell.overheadDeductions)
        .every(({ deductedHours }) => Number.isInteger(deductedHours * 4)),
    ).toBe(true);
    expect(training).toBe(
      (await stored()).overheadCategories.find((row) => row.name === 'Training')
        ?.categoryId,
    );

    const baseline = await stored();
    await editVelocity();
    await velocity.getByLabel('PI velocity override').fill('1.05');
    await velocity.getByRole('button', { name: 'Save PI override' }).click();
    await expect(
      velocity.getByRole('button', { name: 'Clear PI override' }),
    ).toBeEnabled();
    await expect(
      velocity.getByRole('button', { name: 'Save PI override' }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(summary).toContainText('PI override');
    expect((await stored()).kpi.piForecastSpDisplay).toBeGreaterThan(
      baseline.kpi.piForecastSpDisplay!,
    );
    expect(
      (await capacity(request, ids.team, ids.emptyPi)).velocity.source,
    ).toBe('manual_seed');
    expect((await capacity(request, ids.cebu)).velocity.source).toBe('unset');
    await editVelocity();
    await velocity.getByRole('button', { name: 'Clear PI override' }).click();
    await expect(
      velocity.getByRole('button', { name: 'Clear PI override' }),
    ).toHaveCount(0);
    await expect(
      velocity.getByRole('button', { name: 'Save PI override' }),
    ).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(summary).toContainText('Manual seed');

    const override = await request.put('/api/capacity/overhead-deductions', {
      data: {
        teamId: ids.team,
        memberId: baseline.members.find(
          (member) => member.fullName === 'Carlo Reyes',
        )!.memberId,
        iterationId: baseline.iterations[4]!.iterationId,
        categoryId: gw,
        deductedHours: 200,
      },
    });
    expect(override.ok(), await override.text()).toBe(true);
    await page.reload();
    const inspect = memberTable.getByRole('button', {
      name: 'Inspect Carlo Reyes capacity for 2710',
    });
    await expect(inspect).toHaveText('0');
    for (const width of [1440, 1024, 768]) {
      await page.setViewportSize({ width, height: 1000 });
      const expand = memberTable.getByRole('button', {
        name: '2710 · IP',
        exact: true,
      });
      await verifyAxe(page);
      await expand.click();
      await verifyAxe(page);
      await inspect.click();
      const popover = page.getByRole('dialog', { name: /Carlo Reyes/ });
      await expect(popover).toContainText('Hari Raya Puasa');
      await expect(popover).toContainText('(est.)');
      await expect(popover).toContainText('Active absences');
      await expect(popover).toContainText('Half day');
      await expect(popover).toContainText('General work · 200h');
      await expect(popover).toContainText(
        'max(0, Days − Leaves − deductions) × FTE = Dev',
      );
      await expect(popover).toContainText('→ clamped to 0');
      await expect(popover).toContainText('0 days / 0 hours');
      await verifyAxe(page);
      await page.keyboard.press('Escape');
      await expect(inspect).toBeFocused();
      await expand.click();
    }
    const archiveCategory = await request.patch(
      `/api/categories/${development}`,
      { data: { recordStatus: 'archived' } },
    );
    expect(archiveCategory.ok(), await archiveCategory.text()).toBe(true);
    await page.reload();
    await expect(page.getByText(/Invalid allocation/)).toBeVisible();
    await expect(allocation.getByText('Total 100% ✓')).toHaveCount(0);
    await page
      .getByRole('link', { name: 'Team calendar', exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(/\/calendar$/);
    await openCapacity(page);
    await page
      .getByRole('link', { name: /Manage categories in Organization/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/organization$/);

    await openCapacity(page, ids.otherTeam, ids.otherPi);
    await expect(page).toHaveURL(/\/capacity$/);
    await expect(context).toContainText('Delivery ART');
    await expect(context).toContainText('Delivery PI');
    await expect(page.getByText('This PI has no Iterations.')).toBeVisible();
    await expect(summary).toContainText('Unset');
    await expect(page.getByText('No eligible Team members.')).toBeVisible();
    await context.getByRole('button', { name: /Switch Team/ }).click();
    await page
      .getByRole('menu', { name: 'Switch Team' })
      .getByRole('menuitemradio', { name: /Palawan/ })
      .click();
    await expect(context).toContainText('Payments ART');
    await context.getByRole('button', { name: /Switch PI/ }).click();
    await page
      .getByRole('menu', { name: 'Switch PI' })
      .getByRole('menuitemradio', { name: 'PI-2027.2' })
      .click();
    await expect(context).toContainText('PI-2027.2');
    await expect(page.getByText('This PI has no Iterations.')).toBeVisible();

    await openCapacity(page, ids.archivedTeam, ids.pi);
    await expect(
      page.getByText(
        'Viewing archived Archived Palawan · PI-2027.1 (read-only)',
      ),
    ).toBeVisible();
    await expect(context).toContainText('PI-2027.2');
    await expect(
      summary.getByRole('button', { name: /Edit hours per day/ }),
    ).toBeDisabled();
    await expect(
      summary.getByRole('button', { name: 'Edit velocity' }),
    ).toBeDisabled();
    await page
      .getByRole('button', { name: 'Return to active selection' })
      .click();
    await expect(page).toHaveURL(/\/capacity$/);
    await openCapacity(page, ids.archivedTeam, ids.pi);
    await context.getByRole('button', { name: /Switch Team/ }).click();
    await page
      .getByRole('menu', { name: 'Switch Team' })
      .getByRole('menuitemradio', { name: /Cebu/ })
      .click();
    await expect(page).toHaveURL(/\/capacity$/);
    await expect(context).toContainText('Cebu');
    for (const search of [
      `?teamId=${crypto.randomUUID()}&piId=${ids.pi}`,
      `?teamId=${ids.team}`,
      `?teamId=${ids.team}&piId=${ids.otherPi}`,
    ]) {
      await page.goto(`/capacity${search}`);
      await expect(page).toHaveURL(/\/capacity$/);
      await expect(context).toContainText('Cebu');
      await expect(
        page.getByText('Link could not be opened — showing current selection'),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
    }
    expect(outside).toEqual([]);
  } finally {
    await setCapacityFixtureActive(request, false);
  }
});
