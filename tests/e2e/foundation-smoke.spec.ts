import {
  test as base,
  expect,
  type Locator,
  type Page,
} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { z } from 'zod';
import { restoreBackup } from '../../src/persistence/backup';
import { APP_VERSION } from '../../src/persistence/version';
import {
  AppMetadataEntrySchema,
  BackupManifestSchema,
  HealthResponseSchema,
} from '../../src/domain/health/schemas';
import { destinations } from '../../src/ui/shell/nav-config';
import { freezeClock } from '../support/visual-helpers';

const origin = 'http://127.0.0.1:3100';
const testRoot = path.resolve('.azusa/test-playwright');
const dbDir = path.join(testRoot, 'db');
const backupDir = path.join(testRoot, 'backups');
const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const test = base.extend<{ localOnly: void }>({
  localOnly: [
    async ({ context, page }, use) => {
      const external: string[] = [];
      const isLocal = (url: string) => new URL(url).origin === origin;
      await context.route('**/*', async (route) => {
        if (isLocal(route.request().url())) await route.continue();
        else {
          external.push(route.request().url());
          await route.abort();
        }
      });
      page.on('websocket', (socket) => {
        if (new URL(socket.url()).origin !== origin.replace('http:', 'ws:'))
          external.push(socket.url());
      });
      await freezeClock(page);
      await use();
      expect(
        external,
        'All browser requests must remain on the isolated local server',
      ).toEqual([]);
    },
    { auto: true },
  ],
});

async function ready(page: Page, route = '/') {
  await page.goto(route);
  await expect(page.getByRole('timer')).toContainText('No active PI');
}
async function tabTo(page: Page, target: Locator) {
  for (let i = 0; i < 20; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return;
    await page.keyboard.press('Tab');
  }
  await expect(target).toBeFocused();
}
async function visibleFocus(target: Locator) {
  await expect(target).toHaveCSS('outline-width', '2px');
  await expect(target).toHaveCSS('outline-color', 'rgb(224, 127, 36)');
}
async function accessible(page: Page, state: string) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations,
    `Accessibility violations in ${state}: ${JSON.stringify(results.violations)}`,
  ).toEqual([]);
}

test('keyboard-only shell navigation reaches all nine destinations', async ({
  page,
}) => {
  test.setTimeout(90000); // Includes navigation and compilation across nine routes.
  // Compile the routes before testing keyboard navigation in the browser.
  for (const { href } of destinations) {
    const response = await page.request.get(href);
    await expect(response, `Warm ${href}`).toBeOK();
  }
  await ready(page);
  const nav = page.getByRole('button', { name: 'Open navigation' });
  await page.keyboard.press('Tab');
  await expect(nav).toBeFocused();
  await visibleFocus(nav);
  await page.keyboard.press('Enter');
  const menu = page.locator('#azusa-navigation');
  await expect(menu.locator('a')).toHaveText(
    destinations.map((item) => item.title),
  );
  for (const group of ['PI', 'Capacity', 'Sprint', 'Insights'])
    await expect(menu.getByText(group, { exact: true })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Settings' })).toHaveCount(0);
  await page.keyboard.press('ArrowDown');
  await expect(menu.locator('a').first()).toBeFocused();
  await page.keyboard.press('End');
  await expect(menu.locator('a').last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(menu.locator('a').first()).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(menu.locator('a').last()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu.locator('a').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(nav).toBeFocused();
  for (const [index, destination] of destinations.entries()) {
    await tabTo(page, nav);
    await page.keyboard.press(index % 2 ? 'Space' : 'Enter');
    await expect(menu.locator('a[aria-current="page"]')).toHaveAttribute(
      'href',
      new URL(page.url()).pathname,
    );
    await page.keyboard.press('Home');
    for (let step = 0; step < index; step++)
      await page.keyboard.press('ArrowDown');
    await expect(
      menu.getByRole('link', { name: destination.title, exact: true }),
    ).toBeFocused();
    await visibleFocus(
      menu.getByRole('link', { name: destination.title, exact: true }),
    );
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(`${origin}${destination.href}`, {
      timeout: 15000,
    });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      destination.title,
    );
    await expect(page).toHaveTitle(`${destination.title} · Azusa`);
    if (destination.href === '/capacity') {
      await expect(
        page.getByRole('link', { name: 'Team calendar', exact: true }).first(),
      ).toBeVisible();
    } else {
      await expect(page.locator('main')).toContainText(
        `${destination.milestone} · ${destination.feature}`,
      );
      await expect(page.locator('main')).toContainText(
        'This feature is not yet implemented.',
      );
    }
    await expect(menu).toHaveCount(0);
  }
  const search = page.getByRole('button', { name: 'Search', exact: true });
  await tabTo(page, search);
  await visibleFocus(search);
  await page.keyboard.press('Space');
  const input = page.getByRole('searchbox', { name: 'Search' });
  await expect(input).toBeFocused();
  await visibleFocus(input.locator('..'));
  await expect(input).toHaveAttribute(
    'placeholder',
    'Search stories, features…',
  );
  await page.keyboard.type('shell interaction only');
  await page.keyboard.press('Escape');
  await expect(search).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(input).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(input).toHaveCount(0);
  const profile = page.getByRole('button', { name: 'Account menu' });
  await expect(profile).toBeFocused();
  await visibleFocus(profile);
  await page.keyboard.press('Shift+Tab');
  await expect(search).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  const account = page.getByRole('menu', { name: 'Account', exact: true });
  await expect(account).toContainText('Scrum Master');
  await expect(account).toContainText('No ART or team configured');
  await expect(account).not.toContainText('local:sm');
  await page.keyboard.press('ArrowDown');
  const organization = account.getByRole('menuitem', { name: 'Organization' });
  await expect(organization).toBeFocused();
  await expect(organization).toHaveAttribute('href', '/organization');
  await page.keyboard.press('ArrowDown');
  const settings = account.getByRole('menuitem', { name: 'Settings' });
  await expect(settings).toBeFocused();
  await visibleFocus(settings);
  await expect(settings).toHaveAttribute('aria-disabled', 'true');
  await expect(
    page.locator(`#${await settings.getAttribute('aria-describedby')}`),
  ).toHaveText('Configured per feature (F002–F014)');
  const before = page.url();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(before);
  await page.keyboard.press('Escape');
  await expect(profile).toBeFocused();
  expect((await page.request.get('/settings')).status()).toBe(404);
});

test('overlay exclusion and axe scans cover shell states and representative routes', async ({
  page,
}) => {
  await ready(page);
  const nav = page.getByRole('button', { name: 'Open navigation' });
  const profile = page.getByRole('button', { name: 'Account menu' });
  await accessible(page, 'root default');
  await nav.click();
  await accessible(page, 'root navigation open');
  await profile.click();
  await expect(nav).toHaveAttribute('aria-expanded', 'false');
  await expect(profile).toHaveAttribute('aria-expanded', 'true');
  await accessible(page, 'root profile open');
  await nav.click();
  await expect(profile).toHaveAttribute('aria-expanded', 'false');
  await expect(nav).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 768, height: 1000 });
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByTestId('today-widget')).toHaveCSS(
    'visibility',
    'hidden',
  );
  await accessible(page, 'root expanded search at 768px');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('timer')).toBeVisible();
  for (const route of ['/calendar', '/dashboard']) {
    await ready(page, route);
    await accessible(page, route);
  }
});

for (const zone of ['Asia/Manila', 'UTC']) {
  test.describe(`viewer timezone ${zone}`, () => {
    test.use({ timezoneId: zone });
    test('forwards browser timezone for both a normal instant and a UTC date crossing', async ({
      page,
    }) => {
      await ready(page);
      const timer = page.getByRole('timer');
      await expect(timer).toHaveAttribute(
        'aria-label',
        'Current date, calendar week, PI and sprint status, and local time',
      );
      await expect(timer).toContainText('2026/11/08');
      await expect(timer).toContainText('CW45.7');
      await expect(timer).toContainText('No active PI · No active Sprint');
      await expect(timer.locator('time')).toHaveText(
        zone === 'Asia/Manila' ? '1930h' : '1130h',
      );
      await expect(timer).toContainText(zone === 'Asia/Manila' ? 'PHT' : 'UTC');
      await page.clock.setFixedTime(new Date('2026-11-08T18:30:00.000Z'));
      await page.reload();
      await expect(timer).toContainText(
        zone === 'Asia/Manila' ? '2026/11/09' : '2026/11/08',
      );
      await expect(timer).toContainText(
        zone === 'Asia/Manila' ? 'CW46.1' : 'CW45.7',
      );
      await expect(timer.locator('time')).toHaveText(
        zone === 'Asia/Manila' ? '0230h' : '1830h',
      );
      await expect(timer).toContainText(zone === 'Asia/Manila' ? 'PHT' : 'UTC');
    });
  });
}

test('diagnostic record persists across reload and each startup failure is surfaced', async ({
  page,
}) => {
  await ready(page);
  const responsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/health/check') &&
      response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Record diagnostic check' }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  expect(response.headers()['cache-control']).toBe('no-store');
  const result = await response.json();
  expect(result.ok).toBe(true);
  expect(result.record).toMatchObject({
    id: expect.stringMatching(uuidV4),
    key: 'diagnostic.last_check',
    createdBy: 'local:sm',
    updatedBy: 'local:sm',
    checkCount: expect.any(Number),
  });
  expect(result.record.checkCount).toBeGreaterThan(0);
  expect(result.record.createdAt).toMatch(/Z$/);
  expect(result.record.updatedAt).toMatch(/Z$/);
  const health = HealthResponseSchema.parse(result.health);
  expect(health.actor).toBe('local:sm');
  await expect(page.getByRole('status')).toHaveText(
    'Diagnostic check recorded.',
  );
  await page.reload();
  await expect(page.getByRole('timer')).toContainText('No active PI');
  const card = page.getByRole('region', { name: 'Foundation status' });
  await expect(card).toContainText(result.record.id);
  await expect(card.locator('time')).toHaveText(result.record.updatedAt);
  const persisted = HealthResponseSchema.parse(
    await (await page.request.get('/api/health')).json(),
  );
  expect(persisted.latestDiagnostic).toEqual(result.record);
  for (const stage of ['init', 'migration', 'backup']) {
    const headers = { 'x-azusa-test-simulate-error': stage };
    await page.setExtraHTTPHeaders(headers);
    const failure = await page.request.get('/api/health', { headers });
    expect(failure.status()).toBe(503);
    expect(failure.headers()['cache-control']).toBe('no-store');
    const body = HealthResponseSchema.parse(await failure.json());
    expect(body.errors[0]?.stage).toBe(stage);
    await page.reload();
    const alert = page.locator('main').getByRole('alert');
    await expect(alert).toContainText(`${stage}: ${body.errors[0]!.message}`);
    await expect(alert).toContainText(body.errors[0]!.recoveryHint);
  }
  await page.setExtraHTTPHeaders({});
  await page.reload();
  await expect(page.locator('main').getByRole('alert')).toHaveCount(0);
});

async function fingerprint(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function visit(relative: string) {
    for (const entry of await readdir(path.join(root, relative), {
      withFileTypes: true,
    })) {
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) await visit(name);
      else {
        expect(entry.isFile(), `Unexpected database entry ${name}`).toBe(true);
        const hash = createHash('sha256');
        for await (const chunk of createReadStream(path.join(root, name)))
          hash.update(chunk);
        result[name] = hash.digest('hex');
      }
    }
  }
  await visit('');
  return result;
}

test('startup snapshot is visible and sibling restore preserves the running database', async ({
  page,
}) => {
  test.setTimeout(90000);
  await ready(page);
  const initialResponse = await page.request.get('/api/health');
  expect(initialResponse.status()).toBe(200);
  const initial = HealthResponseSchema.parse(await initialResponse.json());
  const comparable = (value: string) =>
    process.platform === 'win32'
      ? path.resolve(value).toLowerCase()
      : path.resolve(value);
  expect(comparable(initial.database.dbDir)).toBe(comparable(dbDir));
  expect(comparable(initial.backup.backupDir)).toBe(comparable(backupDir));
  expect(initial.backup).toMatchObject({
    backupCount: 1,
    lastBackupTrigger: 'startup',
    lastBackupId: expect.stringMatching(/-startup$/),
  });
  const card = page.getByRole('region', { name: 'Foundation status' });
  await expect(card).toContainText(initial.backup.lastBackupId!);
  const manifest = BackupManifestSchema.parse(
    JSON.parse(
      await readFile(
        path.join(backupDir, initial.backup.lastBackupId!, 'manifest.json'),
        'utf-8',
      ),
    ),
  );
  expect(comparable(manifest.sourceDbDir)).toBe(comparable(dbDir));
  const target = path.join(testRoot, 'restored');
  expect(path.dirname(target)).toBe(testRoot);
  expect(
    await access(target).then(
      () => true,
      () => false,
    ),
  ).toBe(false);
  const before = await fingerprint(dbDir);
  try {
    const restored = await restoreBackup({
      from: initial.backup.lastBackupId!,
      to: target,
      activeDbDir: dbDir,
      backupDir,
    });
    expect(restored).toMatchObject({
      ok: true,
      recordCount: 1,
      foundationRecordId: expect.stringMatching(uuidV4),
    });
    expect(await fingerprint(dbDir)).toEqual(before);
    const client = new PGlite(target);
    try {
      await client.waitReady;
      const records = await client.query<{
        id: string;
        key: string;
        value: unknown;
        created_by: string;
        updated_by: string;
        created_at: Date;
        updated_at: Date;
      }>('SELECT * FROM app_metadata');
      expect(records.rows).toHaveLength(1);
      const row = records.rows[0]!;
      expect(row.id).toBe(restored.foundationRecordId);
      expect(AppMetadataEntrySchema.parse(row)).toMatchObject({
        key: 'foundation.init',
        value: {
          schemaVersion: '0000_foundation_init',
          appVersion: APP_VERSION,
        },
      });
      expect([row.created_by, row.updated_by]).toEqual([
        'local:sm',
        'local:sm',
      ]);
      expect(z.date().safeParse(row.created_at).success).toBe(true);
      expect(z.date().safeParse(row.updated_at).success).toBe(true);
    } finally {
      await client.close();
    }
    const after = HealthResponseSchema.parse(
      await (await page.request.get('/api/health')).json(),
    );
    expect(after.status).toBe('healthy');
    expect(after.latestDiagnostic).toEqual(initial.latestDiagnostic);
  } finally {
    await rm(target, { recursive: true, force: true });
  }
});
