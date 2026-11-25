import AxeBuilder from '@axe-core/playwright';
import {
  expect as baseExpect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { getServerTodayIsoDate } from '../../src/domain/calendar/iso-week';

const expect = baseExpect.configure({ timeout: 15_000 });
const tabName = 'Categories & Allocation';
const catalogName = 'ART Work Categories';
const teamName = 'Team PI Allocation';
const feature = 'Feature development';
const debt = 'Technical debt';
const fixtureArts: string[] = [];

test.afterEach(async ({ request }) => {
  // The shell smoke test expects an empty active organization.
  for (const id of fixtureArts.splice(0)) {
    const response = await request.patch(`/api/organization/trains/${id}`, {
      data: { recordStatus: 'archived' },
    });
    expect(response.ok(), await response.text()).toBe(true);
  }
});

async function post(request: APIRequestContext, path: string, data: object) {
  const response = await request.post(`/api/organization/${path}`, { data });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}

function dateAt(offset: number) {
  const date = new Date(`${getServerTodayIsoDate()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

async function fixture(request: APIRequestContext) {
  const suffix = crypto.randomUUID().slice(0, 6);
  const art = await post(request, 'trains', { name: `Payments ART ${suffix}` });
  fixtureArts.push(art.id);
  const other = await post(request, 'trains', {
    name: `Core Platform ART ${suffix}`,
  });
  fixtureArts.push(other.id);
  const trainId: string = art.id;
  const palawan = await post(request, 'teams', { trainId, name: 'Palawan' });
  const cebu = await post(request, 'teams', { trainId, name: 'Cebu' });
  for (const [name, start, end] of [
    ['Past PI', -89, -30],
    ['PI-2027.1', 1, 60],
    ['PI-2027.2', 91, 150],
  ] as const) {
    await post(request, 'pis', {
      trainId,
      name,
      startDate: dateAt(start),
      endDate: dateAt(end),
    });
  }
  return {
    trainId,
    otherId: other.id as string,
    palawanId: palawan.id as string,
    cebuId: cebu.id as string,
  };
}

const region = (page: Page, name: string) =>
  page.getByRole('region', { name, exact: true });
async function open(page: Page, trainId: string) {
  await page.getByRole('tab', { name: tabName }).click();
  await page.getByLabel('ART', { exact: true }).selectOption(trainId);
}

test('category lifecycle, allocation inheritance, drift and accessibility', async ({
  page,
  request,
}) => {
  test.setTimeout(180_000);
  const { trainId, otherId, palawanId, cebuId } = await fixture(request);
  const external: string[] = [];
  page.on('request', (outgoing) => {
    const target = outgoing.url();
    if (
      target.startsWith('http') &&
      new URL(target).origin !== 'http://127.0.0.1:3100'
    )
      external.push(target);
  });
  const catalog = region(page, catalogName);
  const team = region(page, teamName);
  const row = (name: string) =>
    catalog.getByRole('group', { name, exact: true });
  const artDefault = (name: string) =>
    catalog.getByLabel(`${name} ART default percentage`, { exact: true });
  const override = (name: string) =>
    team.getByLabel(`${name} override percentage`, { exact: true });
  const teamRow = (name: string) =>
    team
      .getByRole('row')
      .filter({ has: page.getByRole('rowheader', { name, exact: true }) });
  const saveDefaults = catalog.getByRole('button', {
    name: 'Save ART defaults',
  });
  const saveOverrides = team.getByRole('button', {
    name: 'Save Team allocation',
  });
  const picker = (label: string) => team.getByLabel(label, { exact: true });
  async function choosePair(pi = 'PI-2027.1', teamId = palawanId) {
    await picker('Team').selectOption(teamId);
    await picker('PI').selectOption({ label: pi });
  }
  async function reload() {
    await page.reload();
    await open(page, trainId);
  }
  async function add(name: string, role: string) {
    await catalog.getByRole('button', { name: 'Add Category' }).click();
    const editor = catalog.getByRole('form', { name: 'Add Category' });
    await editor.getByLabel('Category name').fill(name);
    await editor.getByLabel('Short label').fill('EX');
    await editor.getByLabel('Semantic role').selectOption(role);
    await editor.getByRole('button', { name: 'Save', exact: true }).click();
    return editor;
  }

  await page.goto('/organization');
  await open(page, trainId);
  await expect(
    catalog.getByText('Not configured', { exact: true }),
  ).toBeVisible();
  await expect(saveOverrides).toBeDisabled();
  // The past PI starts first; the picker defaults to the current one.
  await expect(picker('PI').locator('option:checked')).toHaveText('PI-2027.1');
  await catalog.getByRole('button', { name: 'Apply sample catalog' }).click();
  await expect(row(feature)).toBeVisible();
  await reload();
  await expect(
    catalog.getByRole('button', { name: 'Apply sample catalog' }),
  ).toHaveCount(0);
  await expect(row(feature)).toContainText('Feature dev.');
  await expect(region(page, 'Development').getByRole('group')).toHaveCount(5);
  await expect(region(page, 'Overhead').getByRole('group')).toHaveCount(2);
  await expect(await add('Extra development', 'standard')).toHaveCount(0);
  await expect(artDefault('Extra development')).toHaveValue('0');

  await row('SW maintenance (bugs)')
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  const editor = catalog.getByRole('form', { name: 'Edit Category' });
  await editor.getByLabel('Category name').fill('Bugs & Support');
  await editor.getByLabel('Color').fill('#BF3535');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(row('Bugs & Support')).toBeVisible();
  await reload();
  await row('Bugs & Support')
    .getByRole('button', { name: 'Edit', exact: true })
    .click();
  await expect(editor.getByLabel('Semantic role')).toHaveValue(
    'maintenance_bugs',
  );
  await expect(editor.getByLabel('Color')).toHaveValue('#BF3535');
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  const duplicate = await add('Second Bugs', 'maintenance_bugs');
  await expect(duplicate.getByRole('alert')).toContainText(
    'already has an active',
  );
  await duplicate.getByRole('button', { name: 'Cancel', exact: true }).click();

  await row('Bugs & Support')
    .getByRole('button', { name: 'Move up', exact: true })
    .click();
  await expect(
    region(page, 'Development').getByRole('group').first(),
  ).toHaveAccessibleName('Bugs & Support');
  await reload();
  await expect(
    region(page, 'Development').getByRole('group').first(),
  ).toHaveAccessibleName('Bugs & Support');
  await page.getByLabel('ART', { exact: true }).selectOption(otherId);
  await expect(
    catalog.getByRole('button', { name: 'Apply sample catalog' }),
  ).toBeVisible();
  await expect(row('Bugs & Support')).toHaveCount(0);
  await page.getByLabel('ART', { exact: true }).selectOption(trainId);

  await artDefault(feature).fill('44');
  await expect(
    catalog.getByText('95% — must total 100%', { exact: true }),
  ).toBeVisible();
  await expect(saveDefaults).toBeDisabled();
  await reload();
  await expect(artDefault(feature)).toHaveValue('49');
  await artDefault(feature).fill('44');
  await artDefault(debt).fill('12');
  await saveDefaults.click();
  await expect(team.getByText('44%', { exact: true }).first()).toBeVisible();
  await row(debt).getByRole('button', { name: 'Archive', exact: true }).click();
  await expect(
    catalog.getByText('88% — must total 100%', { exact: true }),
  ).toBeVisible();
  await reload();
  await expect(row(debt)).toHaveCount(0);
  await catalog.getByLabel('Show archived', { exact: true }).check();
  await row(debt)
    .getByRole('button', { name: 'Reactivate', exact: true })
    .click();
  await expect(catalog.getByText('100% ✓', { exact: true })).toBeVisible();
  await row('Extra development')
    .getByRole('button', { name: 'Delete', exact: true })
    .click();
  await row('Extra development')
    .getByRole('button', { name: 'Confirm delete', exact: true })
    .click();
  await expect(row('Extra development')).toHaveCount(0);
  await reload();
  await expect(row('Extra development')).toHaveCount(0);
  await expect(artDefault(debt)).toHaveValue('12');
  await artDefault(feature).fill('49');
  await artDefault(debt).fill('7');
  await saveDefaults.click();
  await expect(team.getByText('49%', { exact: true }).first()).toBeVisible();

  async function saveTeam() {
    const response = page.waitForResponse(
      (result) =>
        new URL(result.url()).pathname === '/api/categories/allocations' &&
        result.request().method() === 'PUT',
    );
    await saveOverrides.click();
    const saved = await response;
    expect(saved.ok(), await saved.text()).toBe(true);
  }
  async function partial() {
    await override(feature).fill('56');
    await override('Bugs & Support').fill('15');
    await override('Estimations').fill('8');
    await saveTeam();
    await expect(
      teamRow(feature).getByText('Override', { exact: true }),
    ).toBeVisible();
    await expect(saveOverrides).toBeDisabled();
  }
  await choosePair();
  await partial();
  await reload();
  await choosePair();
  await expect(override(feature)).toHaveValue('56');
  await expect(
    row(feature).getByRole('button', { name: 'Delete', exact: true }),
  ).toHaveCount(0);
  await expect(
    row('Enablers').getByRole('button', { name: 'Delete', exact: true }),
  ).toBeVisible();
  await row(feature).getByRole('button', { name: 'Edit', exact: true }).click();
  const kind = editor.getByLabel('Kind', { exact: true });
  await expect(kind.getByRole('option')).toHaveText(['Development']);
  await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    teamRow('Enablers').getByText('Inherit', { exact: true }),
  ).toBeVisible();
  await override(feature).fill('63');
  await override(debt).fill('0');
  await saveTeam();
  await expect(override(debt)).toHaveValue('0');
  await expect(saveOverrides).toBeDisabled();
  await reload();
  await choosePair();
  await expect(override(debt)).toHaveValue('0');
  await expect(
    teamRow(debt).getByText('Override', { exact: true }),
  ).toBeVisible();
  await teamRow(debt)
    .getByRole('button', { name: 'Reset', exact: true })
    .click();
  await override(feature).fill('56');
  await saveTeam();
  await expect(
    teamRow(debt).getByText('Inherit', { exact: true }),
  ).toBeVisible();
  await expect(teamRow(debt).getByText('7%', { exact: true })).toHaveCount(2);
  for (const [pi, id] of [
    ['PI-2027.2', palawanId],
    ['PI-2027.1', cebuId],
  ]) {
    await choosePair(pi, id);
    await expect(team.getByText('Inherit', { exact: true })).toHaveCount(5);
  }
  await choosePair('Past PI');
  await partial();
  await artDefault(feature).fill('45');
  await artDefault('Enablers').fill('18');
  await saveDefaults.click();
  await expect(
    team.getByText('104% — must total 100%', { exact: true }),
  ).toBeVisible();
  await expect(team.getByText(/Drift warning/)).toHaveCount(0);
  await choosePair();
  await expect(
    team.getByRole('status').filter({ hasText: 'Drift warning' }),
  ).toContainText('104%');
  await expect(override(feature)).toHaveValue('56');
  await team.getByRole('button', { name: 'Reset all to ART defaults' }).click();
  await expect(team.getByText('Inherit', { exact: true })).toHaveCount(5);

  const archived = await request.patch(`/api/organization/teams/${cebuId}`, {
    data: { recordStatus: 'archived' },
  });
  expect(archived.ok(), await archived.text()).toBe(true);
  await reload();
  await team.getByLabel('Show archived Teams/PIs').check();
  await choosePair('PI-2027.1', cebuId);
  await expect(
    team.getByText('Archived — read-only', { exact: true }),
  ).toBeVisible();
  await expect(override(feature)).toBeDisabled();
  await expect(saveOverrides).toBeDisabled();
  await expect(
    team.getByRole('button', { name: 'Reset all to ART defaults' }),
  ).toBeDisabled();

  await page.getByRole('button', { name: 'Account menu' }).click();
  await expect(
    page.getByRole('menuitem', { name: 'Settings' }),
  ).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: tabName }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('ART', { exact: true })).toBeFocused();
  for (const width of [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: 900 });
    const { violations } = await new AxeBuilder({ page })
      .include('#org-panel-categories')
      .analyze();
    expect(
      violations.map(({ id, nodes }) => ({
        id,
        targets: nodes.map(({ target }) => target),
      })),
    ).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
  }
  expect(external).toEqual([]);
});
