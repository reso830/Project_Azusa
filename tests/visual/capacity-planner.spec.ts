import { expect, test } from '@playwright/test';
import type { TeamPiCapacityView } from '../../src/domain/capacity/types';
import { bounds, overlaps } from '../support/visual-helpers';
import {
  capacityBrowserIds as ids,
  prepareCapacityCatalog,
  setCapacityFixtureActive,
} from '../support/capacity-browser-fixture';

test('capacity geometry matches the 1440px structure and adapts at smaller widths', async ({
  page,
  request,
}, info) => {
  test.setTimeout(180000);
  const external: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).origin === 'http://127.0.0.1:3100')
      return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  await setCapacityFixtureActive(request, true);
  try {
    const { gw, training } = await prepareCapacityCatalog(request);
    const settings = await request.patch('/api/capacity/team-settings', {
      data: {
        teamId: ids.team,
        seedNormalizedVelocity: 0.92,
      },
    });
    expect(settings.ok(), await settings.text()).toBe(true);
    const deductions = await request.post(
      '/api/capacity/overhead-deductions/bulk',
      {
        data: {
          teamId: ids.team,
          piId: ids.pi,
          mode: 'fixed_days',
          entries: [
            { categoryId: gw, value: 1 },
            { categoryId: training, value: 0.5 },
          ],
        },
      },
    );
    expect(deductions.ok(), await deductions.text()).toBe(true);
    const plan = await request.get(
      `/api/capacity?teamId=${ids.team}&piId=${ids.pi}`,
    );
    expect(plan.ok(), await plan.text()).toBe(true);
    const view: TeamPiCapacityView = await plan.json();
    const adjusted = await request.put('/api/capacity/overhead-deductions', {
      data: {
        teamId: ids.team,
        memberId: view.members.find(
          ({ fullName }) => fullName === 'Carlo Reyes',
        )?.memberId,
        iterationId: view.iterations.find(({ name }) => name === '2706')
          ?.iterationId,
        categoryId: gw,
        deductedHours: 4,
      },
    });
    expect(adjusted.ok(), await adjusted.text()).toBe(true);
    await page.clock.setFixedTime(new Date('2027-02-05T06:11:00.000Z'));
    const summary = page.getByRole('region', { name: 'Capacity summary' });
    const table = page.getByRole('region', { name: 'Member capacity table' });
    const sprint = table.getByRole('button', { name: '2706', exact: true });
    const pi = table.getByRole('button', { name: 'PI-2027.1', exact: true });
    const sprintHeader = sprint.locator('xpath=ancestor::th');
    const piHeader = pi.locator('xpath=ancestor::th');
    const memberHeaderRow = table.getByRole('row').first();
    const overhead = table.getByRole('rowgroup', {
      name: 'Deducted first overhead',
    });
    for (const width of [1440, 1024, 768, 2240]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/capacity?teamId=${ids.team}&piId=${ids.pi}`);
      await expect(page).toHaveURL(/\/capacity$/);
      const context = page.getByRole('navigation', { name: 'Context' });
      for (const label of ['Payments ART', 'Palawan', 'PI-2027.1'])
        await expect(context).toContainText(label);
      await expect(page.getByTestId('today-widget')).toBeAttached();
      await expect(
        page.getByRole('button', { name: 'Search', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Account menu' }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Open navigation' }).click();
      await expect(
        page
          .getByRole('navigation', { name: 'Primary navigation' })
          .getByRole('link', {
            name: 'Capacity planner',
          }),
      ).toHaveAttribute('aria-current', 'page');
      await page.keyboard.press('Escape');
      await expect(summary.getByRole('heading')).toHaveText([
        'Planned SP',
        'Development capacity',
        'Normalized velocity',
        'Forecast SP',
        'Team FTE',
      ]);
      await expect(summary).toContainText('Not yet available');
      await expect(
        page.getByLabel('Hours per day', { exact: true }),
      ).toBeHidden();
      await expect(
        summary.getByRole('button', { name: /Edit hours per day/ }),
      ).toHaveText('291.8 days');
      if (width === 1440) {
        const heading = page.getByRole('heading', { name: 'Capacity planner' });
        await expect(heading).toHaveCSS('font-family', /Zen Kaku Gothic New/);
        await expect(heading).toHaveCSS('font-size', '28px');
        await expect(heading).toHaveCSS('color', 'rgb(26, 27, 34)');
        await expect(
          page.getByRole('heading', { name: 'Member capacity' }),
        ).toHaveCSS('font-size', '20px');
        await expect(
          page.getByText('Deduction mode', { exact: true }),
        ).toHaveCSS('font-size', '11px');
        await expect(
          page.getByRole('button', { name: 'Fixed days', exact: true }),
        ).toHaveCSS('font-weight', '600');
        await expect(
          page.getByRole('button', { name: '% of available', exact: true }),
        ).toHaveCSS('font-weight', '400');
        const planLabel = summary.getByRole('heading', { name: 'Planned SP' });
        await expect(planLabel).toHaveCSS('letter-spacing', '0.96px');
        await expect(planLabel).toHaveCSS('color', 'rgb(216, 211, 203)');
        const devValue = summary.getByRole('button', {
          name: /Edit hours per day/,
        });
        await expect(devValue).toHaveCSS('font-family', /IBM Plex Sans/);
        await expect(devValue).toHaveCSS('font-size', '32px');
        const locationBadge = table.getByText('PH', { exact: true }).first();
        await expect(locationBadge).toHaveCSS('font-family', /IBM Plex Sans/);
        await expect(locationBadge).toHaveCSS('font-size', '10.5px');
        await expect(locationBadge).toHaveCSS('font-weight', '700');
        await expect(sprintHeader.getByText(/Feb 1/)).toHaveCSS(
          'color',
          'rgb(255, 255, 255)',
        );
        const holiday = table.getByText('−1 holiday est.', { exact: true });
        await expect(holiday.first()).toHaveCSS('font-size', '12px');
        await expect(holiday.first()).toHaveCSS('color', 'rgb(154, 106, 0)');
      }
      await expect(pi).toHaveCSS('white-space', 'nowrap');
      await expect(sprint).toHaveAccessibleDescription(/1 location off/);
      await expect(
        overhead.getByRole('button', {
          name: 'Bulk overhead for General work',
        }),
      ).toHaveAttribute('aria-expanded', 'false');
      await expect(
        page.getByRole('button', { name: 'Save hours' }),
      ).toHaveCount(0);
      await expect(
        summary.getByRole('button', { name: 'Edit velocity' }),
      ).toHaveText('Manual seed');
      await expect(
        summary.getByRole('button', { name: 'Excluded members (2)' }),
      ).toHaveText('7.5 FTE');
      await expect(
        page.getByRole('link', { name: 'Manage categories in Organization' }),
      ).toHaveText('Category');
      await expect(
        page.getByRole('link', { name: 'Team calendar', exact: true }),
      ).toHaveCount(1);
      const cards = await Promise.all(
        (await summary.getByRole('article').all()).map(bounds),
      );
      if (width === 1440)
        expect(new Set(cards.map((card) => card.y)).size).toBe(1);
      for (const [index, card] of cards.entries()) {
        expect(card.x + card.width).toBeLessThanOrEqual(width);
        for (const next of cards.slice(index + 1))
          expect(overlaps(card, next)).toBe(false);
      }
      for (const region of [
        'Team allocation matrix',
        'Member capacity table',
      ]) {
        const box = await bounds(page.getByRole('region', { name: region }));
        expect(box.x + box.width).toBeLessThanOrEqual(width);
      }
      await expect(overhead).toBeVisible();
      for (const expanded of [false, true]) {
        if (expanded) await sprint.click();
        await expect(sprint).toHaveAttribute('aria-expanded', String(expanded));
        expect((await bounds(memberHeaderRow)).height).toBe(80);
        if (expanded) {
          const wide = await bounds(sprintHeader);
          const normal = await bounds(
            table
              .getByRole('button', { name: '2704', exact: true })
              .locator('xpath=ancestor::th'),
          );
          // Shared column boundaries are rounded to whole pixels.
          expect(Math.abs(wide.width - normal.width * 2.8)).toBeLessThan(4);
          const band = await bounds(
            sprintHeader.getByText('Days', { exact: true }).locator('..'),
          );
          expect(band.height).toBe(27);
          expect(band.y + band.height).toBe(wide.y + wide.height);
          const trainingHeader = sprintHeader.getByTitle('Training', {
            exact: true,
          });
          await expect(trainingHeader).toHaveText('TR');
          await expect(trainingHeader).toHaveCSS('text-transform', 'uppercase');
          await expect(trainingHeader).toHaveCSS(
            'background-color',
            'rgb(0, 176, 240)',
          );
          const inline = table.getByLabel(
            'General work deduction days for Hana Villanueva in 2706',
          );
          expect((await bounds(inline)).width).toBeGreaterThan(40);
          const carlo = table.getByRole('cell').filter({
            has: page.getByLabel(
              'General work deduction days for Carlo Reyes in 2706',
            ),
          });
          await expect(carlo).not.toContainText(/−2 leave/);
          await expect(
            table
              .getByRole('row', { name: /^Team dev days/ })
              .getByRole('cell')
              .nth(3)
              .locator('span, strong'),
          ).toHaveText(['79', '3', '7.5', '4', '60.3']);
        }
        if (width >= 1440) {
          const allocation = page.getByRole('region', {
            name: 'Team allocation matrix',
          });
          for (const viewport of [allocation, table]) {
            expect(await viewport.evaluate((node) => node.scrollWidth)).toBe(
              await viewport.evaluate((node) => node.clientWidth),
            );
          }
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: info.outputPath(
            `capacity-${width}-${expanded ? 'expanded' : 'collapsed'}.png`,
          ),
          fullPage: true,
        });
      }
      await pi.click();
      expect((await bounds(memberHeaderRow)).height).toBe(80);
      expect(
        (
          await bounds(
            piHeader.getByText('Days', { exact: true }).locator('..'),
          )
        ).height,
      ).toBe(27);
      await sprint.click();
      await expect(overhead).toContainText('60h');
      if (width === 1440) {
        await table
          .getByRole('button', {
            name: 'Inspect Hana Villanueva capacity for 2706',
          })
          .click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.screenshot({
          path: info.outputPath('capacity-1440-breakdown.png'),
        });
        await page.keyboard.press('Escape');
      }
    }
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await setCapacityFixtureActive(request, false);
  }
});
