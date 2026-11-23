import { test, expect } from '@playwright/test';
import {
  freezeClock,
  bounds,
  overlaps,
  rgbToHex,
} from '../support/visual-helpers';
import { destinations } from '../../src/ui/shell/nav-config';
import {
  kumikoIcons,
  type KumikoIconName,
} from '../../src/ui/icons/kumiko-icons';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KumikoIcon } from '../../src/ui/icons/KumikoIcon';

for (const width of [1440, 1024, 768]) {
  test(`shell geometry, tokens and overlays at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await freezeClock(page);
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const header = page.locator('header');
    const today = page.getByTestId('today-widget');
    await expect(today).toHaveAttribute(
      'aria-label',
      'Current date, calendar week, PI and sprint status, and local time',
    );
    const nav = page.getByRole('button', { name: 'Open navigation' });
    const search = page.getByRole('button', { name: 'Search', exact: true });
    const profile = page.getByRole('button', { name: 'Account menu' });
    await expect(today).toContainText('2026/11/08');
    await expect(today).toContainText('CW45.7');
    await expect(today).toContainText('No active PI · No active Sprint');
    await expect(today).toContainText('1930h');
    await expect(today).toContainText('PHT');
    await expect(header).toHaveCSS('position', 'sticky');
    await expect(header).toHaveCSS('top', '0px');
    for (const card of await page.locator('main > section').all()) {
      await expect(card).toHaveCSS('border-top-width', '0px');
      await expect(card).toHaveCSS('box-shadow', 'none');
    }
    const diagnostic = page.getByRole('button', {
      name: 'Record diagnostic check',
    });
    await expect(diagnostic).toHaveCSS('background-color', 'rgb(26, 27, 34)');
    await expect(diagnostic).toHaveCSS('color', 'rgb(255, 255, 255)');

    const timeBox = await bounds(today);
    await expect(today).toHaveCSS('position', 'static');
    expect(timeBox.x + timeBox.width).toBeCloseTo(
      (await bounds(search)).x - 20,
      0,
    );
    for (const row of await today.locator(':scope > span').all()) {
      const rowBox = await bounds(row);
      expect(rowBox.x + rowBox.width).toBeCloseTo(timeBox.x + timeBox.width, 0);
    }
    expect((await bounds(profile)).x + 40).toBeCloseTo(width - 28, 0);
    const headerHeight = (await bounds(header)).height;
    for (const [element, size] of [
      [nav, 64],
      [nav.locator('img'), 60],
      [search, 40],
      [profile, 40],
    ] as const) {
      expect((await bounds(element)).width).toBe(size);
      expect((await bounds(element)).height).toBe(size);
    }
    for (const control of [nav, search, profile])
      expect(overlaps(timeBox, await bounds(control))).toBe(false);
    const background = page.getByTestId('asanoha-background').first();
    expect((await bounds(background)).width).toBeCloseTo(width * 0.8, 0);
    expect((await bounds(background)).height).toBeCloseTo(width * 0.8, 0);
    await expect(background).toHaveCSS('pointer-events', 'none');
    for (const [token, hex] of Object.entries({
      'page-bg': '#f4f1ec',
      surface: '#ffffff',
      ink: '#1a1b22',
      'brand-orange': '#e07f24',
      'orange-text': '#a65307',
      'clock-orange': '#a65307',
    })) {
      const value = await page.evaluate(
        (name) =>
          getComputedStyle(document.documentElement)
            .getPropertyValue(`--color-${name}`)
            .trim(),
        token,
      );
      expect(value.toLowerCase()).toBe(hex);
    }
    expect(
      rgbToHex(
        await page
          .locator('body')
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      ),
    ).toBe('#f4f1ec');
    await expect(
      page.getByRole('heading', { name: 'Team PI board', exact: true }).first(),
    ).toHaveCSS('font-family', /Zen Kaku Gothic New/);
    await expect(page.locator('body')).toHaveCSS(
      'font-family',
      /IBM Plex Sans/,
    );
    await expect(today.locator('time')).toHaveCSS(
      'font-family',
      /IBM Plex Mono/,
    );
    await expect(today.locator('time')).toHaveCSS('color', 'rgb(166, 83, 7)');
    await expect(page.getByRole('navigation', { name: 'Context' })).toHaveCount(
      0,
    );
    await expect(page.getByText('Payments ART')).toHaveCount(0);
    await page.screenshot({
      path: info.outputPath(`${width}-shell.png`),
      fullPage: true,
    });
    await nav.click();
    const menu = page.locator('#azusa-navigation');
    expect((await bounds(menu)).width).toBe(290);
    await expect(menu.locator('a')).toHaveCount(9);
    await expect(menu.getByRole('link', { name: 'Settings' })).toHaveCount(0);
    await expect(
      menu.getByRole('link', { name: 'Team PI board', exact: true }),
    ).toHaveAttribute('aria-current', 'page');
    await page.screenshot({
      path: info.outputPath(`${width}-navigation.png`),
      fullPage: true,
    });
    await profile.click();
    await expect(menu).toHaveCount(0);
    const account = page.getByRole('menu', { name: 'Account', exact: true });
    expect((await bounds(account)).width).toBe(250);
    await expect(account).toContainText('Scrum Master');
    await expect(account).toContainText('No ART or team configured');
    await expect(account).not.toContainText('local:sm');
    const settings = account.getByRole('menuitem', { name: 'Settings' });
    await expect(settings).toHaveAttribute('aria-disabled', 'true');
    const describedBy = await settings.getAttribute('aria-describedby');
    await expect(page.locator(`#${describedBy}`)).toBeVisible();
    await expect(page.locator(`#${describedBy}`)).toHaveText(
      'Configured per feature (F002–F014)',
    );
    await page.screenshot({
      path: info.outputPath(`${width}-profile.png`),
      fullPage: true,
    });
    await settings.click({ force: true });
    expect(new URL(page.url()).pathname).toBe('/');
    await page.keyboard.press('Escape');
    await expect(profile).toBeFocused();
    await search.click();
    const input = page.getByRole('searchbox', { name: 'Search' });
    await expect(input).toBeFocused();
    await expect(input).toHaveCSS('outline-style', 'none');
    await expect(input.locator('..')).toHaveCSS('outline-width', '2px');
    await expect(input.locator('..')).toHaveCSS('border-radius', '20px');
    expect((await bounds(input.locator('..'))).width).toBe(280);
    expect((await bounds(header)).height).toBe(headerHeight);
    expect((await bounds(profile)).x + 40).toBeCloseTo(width - 28, 0);
    if (width < 1100) await expect(today).toHaveCSS('visibility', 'hidden');
    else {
      await expect(today).toHaveCSS('visibility', 'visible');
      expect(
        overlaps(await bounds(today), await bounds(input.locator('..'))),
      ).toBe(false);
    }
    expect(overlaps(await bounds(nav), await bounds(input.locator('..')))).toBe(
      false,
    );
    expect(
      overlaps(await bounds(profile), await bounds(input.locator('..'))),
    ).toBe(false);
    await page.screenshot({
      path: info.outputPath(`${width}-search.png`),
      fullPage: true,
    });
    await input.press('Escape');
    await expect(today).toHaveCSS('visibility', 'visible');
    await expect(
      page.getByRole('button', { name: 'Search', exact: true }),
    ).toBeFocused();
    await nav.focus();
    await nav.press('ArrowDown');
    const links = page.locator('#azusa-navigation a');
    await expect(links.first()).toBeFocused();
    await page.keyboard.press('End');
    await expect(links.last()).toBeFocused();
    await page.keyboard.press('Home');
    await expect(links.first()).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(links.last()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(nav).toBeFocused();
    await nav.click();
    await nav.press('ArrowUp');
    await expect(page.locator('#azusa-navigation a').last()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(nav).toHaveCSS('outline-width', '2px');
    await nav.press('End');
    await page.locator('#azusa-navigation a').last().press('Tab');
    await expect(search).toBeFocused();
    await expect(page.locator('#azusa-navigation')).toHaveCount(0);
    await profile.click();
    await profile.press('ArrowDown');
    await page
      .locator('#azusa-profile-menu')
      .getByRole('menuitem')
      .press('Tab');
    await expect(diagnostic).toBeFocused();
    await expect(page.locator('#azusa-profile-menu')).toHaveCount(0);

    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  });
}

test('all nine destinations render their own placeholder and badge', async ({
  page,
}) => {
  test.setTimeout(90000); // Includes cold compilation across nine routes.
  await freezeClock(page);
  for (const destination of destinations) {
    await page.goto(destination.href);
    await expect(page).toHaveTitle(`${destination.title} · Azusa`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      destination.title,
    );
    await expect(page.locator('main')).toContainText(
      `${destination.milestone} · ${destination.feature}`,
    );
    await expect(page.locator('main')).toContainText(
      'This feature is not yet implemented.',
    );
    await expect(
      page.getByRole('heading', { name: 'Foundation status' }),
    ).toBeVisible();
  }
  expect((await page.request.get('/settings')).status()).toBe(404);
});

test('all 42 Kumiko icons preserve wrapper geometry and size ramp', async ({
  page,
}, info) => {
  const names = Object.keys(kumikoIcons) as KumikoIconName[];
  await page.setContent(
    `<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:20px;background:#F4F1EC;padding:30px">${names.map((name) => `<div>${renderToStaticMarkup(createElement(KumikoIcon, { name, size: 40, label: name }))}<p>${name}</p></div>`).join('')}</div>`,
  );
  await expect(page.locator('svg')).toHaveCount(42);
  for (const icon of await page.locator('svg').all()) {
    await expect(icon).toHaveAttribute('viewBox', '0 0 24 24');
    await expect(icon).toHaveAttribute('fill', 'none');
    await expect(icon).toHaveAttribute('stroke-width', '1.75');
    expect((await bounds(icon)).width).toBe(40);
  }
  await page.screenshot({
    path: info.outputPath('kumiko-icons.png'),
    fullPage: true,
  });
  for (const size of [16, 18, 20, 24, 32, 40]) {
    await page.setContent(
      renderToStaticMarkup(
        createElement(KumikoIcon, { name: 'team-board', size }),
      ),
    );
    expect((await bounds(page.locator('svg'))).width).toBe(size);
  }
});

test('structured failure stages are visible in the error scene', async ({
  page,
}, info) => {
  await freezeClock(page);
  for (const stage of ['init', 'backup', 'migration']) {
    await page.setExtraHTTPHeaders({ 'x-azusa-test-simulate-error': stage });
    await page.goto('/');
    const alert = page.locator('main').getByRole('alert');
    await expect(alert).toContainText(`${stage}: Simulated failure`);
    await expect(alert).toHaveCSS('border-top-width', '1px');
    await expect(alert).toContainText(
      'docs/operations/database-and-recovery.md',
    );
    expect(
      (await alert.textContent())?.match(
        /docs\/operations\/database-and-recovery\.md/g,
      ),
    ).toHaveLength(1);
    expect(
      (
        await page.request.get('/api/health', {
          headers: { 'x-azusa-test-simulate-error': stage },
        })
      ).status(),
    ).toBe(503);
    await page.screenshot({
      path: info.outputPath(`${stage}-error.png`),
      fullPage: true,
    });
  }
});
