import { expect, test } from '@playwright/test';
import {
  resolveTeamPiAllocation,
  validateArtDefaultTotals,
} from '../../src/domain/categories/rules';
import { SAMPLE_CATEGORY_CATALOG } from '../../src/domain/categories/sample-catalog';
import { bounds, overlaps } from '../support/visual-helpers';

for (const width of [1440, 1024, 768]) {
  test(`Categories & Allocation geometry at ${width}px`, async ({
    page,
  }, info) => {
    test.setTimeout(90_000);
    // Keep the shared visual database empty for the shell tests.
    const trainId = 'visual-art';
    const teamId = 'visual-team';
    const piId = 'visual-pi';
    const recordStatus = 'active' as const;
    const fixture = SAMPLE_CATEGORY_CATALOG.map((category, index) => ({
      ...category,
      id: String(index),
      trainId,
      recordStatus,
      isReferenced: false,
    }));
    for (const [path, json] of [
      ['trains', [{ id: trainId, name: 'Payments ART', recordStatus }]],
      ['teams', [{ id: teamId, name: 'Palawan', recordStatus }]],
      ['pis', [{ id: piId, name: 'PI-2027.1', recordStatus }]],
    ] as const) {
      await page.route(
        (url) => url.pathname === `/api/organization/${path}`,
        (route) => route.fulfill({ json }),
      );
    }
    let categories: typeof fixture = [];
    const catalogResponse = () => ({
      trainId,
      categories,
      totalCategoryCount: categories.length,
      ...validateArtDefaultTotals(categories),
      driftedAllocations: [],
    });
    let finishLoading = () => {};
    const delayed = new Promise<void>((resolve) => {
      finishLoading = resolve;
    });
    let failOnce = width === 1440;
    await page.route(
      (url) => url.pathname === '/api/categories',
      async (route) => {
        if (
          failOnce &&
          new URL(route.request().url()).searchParams.get('includeArchived') ===
            'true'
        ) {
          failOnce = false;
          await delayed;
          return route.fulfill({
            status: 503,
            json: { error: { message: 'Category catalog unavailable.' } },
          });
        }
        return route.fulfill({ json: catalogResponse() });
      },
    );
    await page.route('**/api/categories/sample', (route) => {
      categories = fixture;
      return route.fulfill({ status: 201, json: catalogResponse() });
    });
    await page.route(
      (url) => url.pathname === '/api/categories/allocations',
      (route) =>
        route.fulfill({
          json: resolveTeamPiAllocation({
            trainId,
            teamId,
            piId,
            teamRecordStatus: recordStatus,
            piRecordStatus: recordStatus,
            piEndDate: '2027-03-12',
            today: '2026-11-24',
            activeDevCategories: categories.filter(
              (
                category,
              ): category is Extract<
                (typeof fixture)[number],
                { kind: 'development' }
              > => category.kind === 'development',
            ),
            overridesByCategoryId: new Map(),
          }),
        }),
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/organization');
    const tabs = page.getByRole('tablist', { name: 'Organization sections' });
    const target = tabs.getByRole('tab', { name: 'Categories & Allocation' });
    await expect(tabs.getByRole('tab')).toHaveCount(4);
    await tabs.getByRole('tab', { name: 'ARTs & PI Cadence' }).focus();
    await page.keyboard.press('End');
    await expect(target).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(tabs.getByRole('tab', { name: 'Locations' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(target).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(
      tabs.getByRole('tab', { name: 'ARTs & PI Cadence' }),
    ).toBeFocused();
    await page.keyboard.press('End');
    await page.getByLabel('ART', { exact: true }).selectOption(trainId);
    const catalog = page.getByRole('region', { name: 'ART Work Categories' });
    if (width === 1440) {
      await catalog.getByLabel('Show archived', { exact: true }).check();
      await expect(
        catalog.getByText('Loading…', { exact: true }),
      ).toBeVisible();
      finishLoading();
      const alert = catalog.getByRole('alert');
      await expect(alert).toContainText('Category catalog unavailable.');
      await alert.getByRole('button', { name: 'Retry' }).click();
      await expect(
        catalog.getByRole('button', { name: 'Apply sample catalog' }),
      ).toBeVisible();
      await catalog.getByLabel('Show archived', { exact: true }).uncheck();
    }
    await expect(
      page.getByRole('button', { name: 'Apply sample catalog' }),
    ).toBeVisible();
    await expect(
      page.getByText('Not configured', { exact: true }).first(),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath('categories-empty.png'),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Apply sample catalog' }).click();
    const teamPanel = page.getByRole('region', { name: 'Team PI Allocation' });
    await expect(teamPanel.getByRole('table')).toBeVisible();
    await expect(teamPanel.getByText('100% ✓', { exact: true })).toBeVisible();
    expect(overlaps(await bounds(catalog), await bounds(teamPanel))).toBe(
      false,
    );
    const tableFits = await teamPanel.getByRole('table').evaluate((table) => {
      const box = table.getBoundingClientRect();
      return box.left >= 0 && box.right <= document.documentElement.clientWidth;
    });
    expect(tableFits).toBe(true);
    const header = page.getByRole('banner');
    await expect(header.getByTestId('today-widget')).toHaveCount(0);
    await expect(
      header.getByRole('navigation', { name: 'Context' }),
    ).toHaveCount(0);
    const profile = page.getByRole('button', { name: 'Account menu' });
    await profile.click();
    await expect(
      page.getByRole('menuitem', { name: 'Settings' }),
    ).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await expect(
      page
        .getByRole('navigation', { name: 'Primary navigation' })
        .locator('[aria-current]'),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const search = page.getByPlaceholder('Search organization…');
    await expect(search).toBeVisible();
    expect(overlaps(await bounds(search), await bounds(profile))).toBe(false);
    await page.keyboard.press('Escape');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    await page.screenshot({
      path: info.outputPath('categories-populated.png'),
      fullPage: true,
    });
  });
}
