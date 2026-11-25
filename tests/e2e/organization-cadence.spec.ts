import AxeBuilder from '@axe-core/playwright';
import {
  expect as baseExpect,
  test,
  type Locator,
  type Page,
} from '@playwright/test';

// Cold Next.js route compilation can delay responses in a full-suite run.
const expect = baseExpect.configure({ timeout: 15_000 });
test.use({ actionTimeout: 15_000 });

const labels = {
  cadence: 'ARTs & PI Cadence',
  teams: 'Teams & Members',
  locations: 'Locations',
};
const categoriesTab = 'Categories & Allocation';
const section = (page: Page, name: string) =>
  page.getByRole('region', { name, exact: true });
const tab = (page: Page, name: string) =>
  page.getByRole('tab', { name, exact: true });
const action = (scope: Page | Locator, name: string) =>
  scope.getByRole('button', { name, exact: true });
const group = (scope: Page | Locator, name: string) =>
  scope.getByRole('group', { name, exact: true });
const profile = (page: Page) =>
  page.getByRole('button', { name: 'Account menu' });

async function fillForm(
  page: Page,
  title: string,
  fields: Record<string, string>,
  submit = true,
) {
  const editor = page.getByRole('form', { name: title });
  for (const [label, value] of Object.entries(fields)) {
    const field = editor.getByLabel(label, { exact: true });
    if (await field.evaluate((element) => element.tagName === 'SELECT'))
      await field.selectOption({ label: value });
    else await field.fill(value);
  }
  if (submit) await action(editor, 'Save').click();
  return editor;
}

async function save(page: Page, title: string, fields: Record<string, string>) {
  await expect(await fillForm(page, title, fields)).toHaveCount(0);
}

async function pick(scope: Page | Locator, label: string, value: string) {
  await scope.getByLabel(label, { exact: true }).selectOption({ label: value });
}

async function checkAxe(page: Page, scope: string) {
  const { violations } = await new AxeBuilder({ page })
    .include(scope)
    .analyze();
  expect(
    violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map((node) => node.target),
    })),
  ).toEqual([]);
}

test('US1–US4 Organization management, persistence, shell and accessibility', async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const suffix = crypto.randomUUID().slice(0, 6);
  const officeCode = `JP-${suffix.toUpperCase()}`;
  const draftArt = `Payments ${suffix}`;
  const paymentsArt = `Payments ART ${suffix}`;
  const spareArt = `Z Spare ART ${suffix}`;
  const mistakeArt = `Z Mistake ${suffix}`;
  const external: string[] = [];
  page.on('request', (request) => {
    if (
      request.url().startsWith('http') &&
      new URL(request.url()).origin !== 'http://127.0.0.1:3100'
    )
      external.push(request.url());
  });
  await page.clock.setFixedTime(new Date('2027-01-01T02:00:00Z'));
  await page.goto('/');
  await profile(page).click();
  await expect(
    page.getByRole('menuitem', { name: 'Settings' }),
  ).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('menuitem', { name: 'Organization' }).click();
  await expect(page).toHaveURL(/\/organization$/);
  await expect(
    page.getByRole('heading', { name: 'Organization', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('today-widget')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Context' })).toHaveCount(
    0,
  );
  await action(page, 'Open navigation').click();
  await expect(
    page
      .getByRole('navigation', { name: 'Primary navigation' })
      .locator('[aria-current]'),
  ).toHaveCount(0);
  await action(page, 'Search').click();
  await expect(page.getByRole('searchbox')).toHaveAttribute(
    'placeholder',
    'Search organization…',
  );
  await page.keyboard.press('Escape');
  await expect(action(page, 'Search')).toBeFocused();

  await tab(page, labels.cadence).press('End');
  await expect(tab(page, categoriesTab)).toBeFocused();
  await tab(page, categoriesTab).press('ArrowLeft');
  await expect(tab(page, labels.locations)).toBeFocused();
  const locations = section(page, 'Locations');
  const registry = page.getByRole('region', { name: 'Location registry' });
  await expect(registry.getByRole('cell').first()).toHaveText('PH');
  await expect(
    registry.getByRole('cell', { name: 'UTC+8', exact: true }).first(),
  ).toBeVisible();
  const singapore = registry.getByRole('row', { name: /SG Singapore/ });
  await action(singapore, 'View holidays').click();
  await pick(page, 'Holiday year', '2027');
  const holidays = section(page, 'Singapore holidays');
  await expect(
    holidays.getByRole('row', { name: /Hari Raya Puasa/ }),
  ).toContainText('est.');
  await expect(holidays.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await action(holidays, 'Close holidays').click();

  await action(locations, 'Add Location').click();
  await save(page, 'Add Location', {
    Code: officeCode,
    'Location name': 'Japan',
    'Country code': 'JP',
    'Time zone': 'Asia/Tokyo',
    'Calendar source': 'Public holidays, JP',
  });
  await action(
    registry.getByRole('row', { name: new RegExp(`${officeCode} Japan`) }),
    'Edit',
  ).click();
  await expect(
    page
      .getByRole('form', { name: 'Edit Location' })
      .getByLabel('Code', { exact: true }),
  ).not.toBeEditable();
  await save(page, 'Edit Location', { 'Location name': 'Tokyo Office' });
  await page.reload();
  await tab(page, labels.locations).click();
  const tokyo = registry.getByRole('row', {
    name: new RegExp(`${officeCode} Tokyo Office`),
  });
  await expect(tokyo).toBeVisible();
  await action(tokyo, 'Archive').click();
  await expect(tokyo).toHaveCount(0);
  await page.getByLabel('Show archived Locations').check();
  await expect(tokyo).toContainText('Archived');

  await tab(page, labels.cadence).click();
  const arts = section(page, 'ARTs');
  const pis = section(page, 'Program increments');
  const iterations = section(page, 'Iterations');
  await action(arts, 'Add ART').click();
  await save(page, 'Add ART', { Name: draftArt });
  await pick(arts, 'ART', draftArt);
  await action(group(arts, draftArt), 'Edit').click();
  await save(page, 'Edit ART', { Name: paymentsArt });
  await page.reload();
  await pick(arts, 'ART', paymentsArt);
  await expect(group(arts, paymentsArt)).toBeVisible();
  await action(arts, 'Add ART').click();
  await save(page, 'Add ART', { Name: spareArt });
  await action(arts, 'Add ART').click();
  await save(page, 'Add ART', { Name: mistakeArt });
  await pick(arts, 'ART', mistakeArt);
  await action(group(arts, mistakeArt), 'Delete').click();
  await action(group(arts, mistakeArt), 'Confirm delete').click();
  await expect(arts.getByRole('option', { name: mistakeArt })).toHaveCount(0);
  await pick(arts, 'ART', paymentsArt);

  const dates = { 'Start date': '2027-01-01', 'End date': '2027-01-29' };
  await action(pis, 'Add PI').click();
  await save(page, 'Add PI', { Name: 'PI-2027', ...dates });
  await action(group(pis, 'PI-2027'), 'Edit').click();
  await save(page, 'Edit PI', { Name: 'PI-2027.1' });
  await page.reload();
  await pick(arts, 'ART', paymentsArt);
  await expect(group(pis, 'PI-2027.1')).toContainText('Planning');
  await action(pis, 'Add PI').click();
  const clash = await fillForm(page, 'Add PI', { Name: 'Overlap', ...dates });
  await expect(clash.getByRole('alert')).toContainText(/overlap/i);
  await action(clash, 'Cancel').click();
  await action(pis, 'Add PI').click();
  await save(page, 'Add PI', {
    Name: 'PI-2027.2',
    'Start date': '2027-02-01',
    'End date': '2027-02-26',
  });
  await pick(arts, 'ART', spareArt);
  await action(pis, 'Add PI').click();
  await save(page, 'Add PI', { Name: 'Same dates', ...dates });
  await expect(group(pis, 'Same dates')).toBeVisible();
  await pick(arts, 'ART', paymentsArt);

  await action(iterations, 'Add Iteration').click();
  const sprint = await fillForm(page, 'Add Iteration', {
    Name: 'Weekend',
    'Start date': '2027-01-02',
    'End date': '2027-01-15',
  });
  await expect(sprint.getByRole('alert')).toHaveText(
    'Sprint dates must fall Monday through Friday',
  );
  await fillForm(page, 'Add Iteration', { 'Start date': '2027-01-04' }, false);
  await action(sprint, 'Suggest YYWW').click();
  await expect(sprint.getByLabel('Name', { exact: true })).toHaveValue('2702');
  await action(sprint, 'Save').click();
  await action(group(iterations, '2702'), 'Edit').click();
  await save(page, 'Edit Iteration', { Name: 'Sprint 5' });
  await page.reload();
  await pick(arts, 'ART', paymentsArt);
  await expect(group(iterations, 'Sprint 5')).toContainText(
    '2027-01-04 – 2027-01-15',
  );
  await action(iterations, 'Add Iteration').click();
  const invalid = await fillForm(page, 'Add Iteration', {
    Name: 'IP',
    'Iteration kind': 'IP',
    'Start date': '2027-01-15',
    'End date': '2027-02-01',
  });
  await expect(invalid.getByRole('alert')).toContainText(/within/i);
  await fillForm(page, 'Add Iteration', { 'End date': '2027-01-29' });
  await expect(invalid.getByRole('alert')).toContainText(/overlap/i);
  await fillForm(page, 'Add Iteration', { 'Start date': '2027-01-18' });
  await expect(invalid).toHaveCount(0);
  await expect(group(iterations, 'IP')).toBeVisible();

  const teams = section(page, 'Teams');
  await tab(page, labels.teams).click();
  await pick(teams, 'ART', paymentsArt);
  const members = section(page, 'Members');
  await action(teams, 'Add Team').click();
  await save(page, 'Add Team', { Name: 'Lead Team' });
  await action(group(teams, 'Lead Team'), 'Edit').click();
  await save(page, 'Edit Team', {
    Name: 'Palawan',
    'Sprint offset': '−1 working day · lead',
  });
  await page.reload();
  await tab(page, labels.teams).click();
  await pick(teams, 'ART', paymentsArt);
  await expect(group(teams, 'Palawan')).toContainText(
    '8.0 h/day · -1 working-day offset',
  );
  await action(teams, 'Add Team').click();
  await save(page, 'Add Team', { Name: 'Z Cebu' });
  await expect(teams.getByRole('option', { name: 'Z Cebu' })).toBeAttached();
  await action(members, 'Add Member').click();
  const addMember = page.getByRole('form', { name: 'Add Member' });
  await expect(
    addMember.getByRole('option', { name: `${officeCode} · Tokyo Office` }),
  ).toHaveCount(0);
  await save(page, 'Add Member', {
    'Full name': 'Jane Lee',
    Initials: 'JL',
    Role: 'PO',
    Location: 'PH · Philippines',
  });
  await action(group(members, 'Jane Lee'), 'Edit').click();
  await save(page, 'Edit Member', { 'Full name': 'Jane Lee Edited' });
  await page.reload();
  await tab(page, labels.teams).click();
  await pick(teams, 'ART', paymentsArt);
  const jane = group(members, 'Jane Lee Edited');
  await expect(jane).toContainText('Excluded from dev capacity');
  await action(jane, 'Move').click();
  await save(page, 'Move Member', {
    'Destination Team': `Z Cebu · ${paymentsArt}`,
    'Effective date': '2099-12-01',
  });
  await expect(jane).toContainText('Pending move to Z Cebu');
  await action(jane, 'Cancel pending move').click();
  await expect(jane).not.toContainText('Pending move');
  await action(jane, 'Move').click();
  await save(page, 'Move Member', {
    'Destination Team': `Z Cebu · ${paymentsArt}`,
  });
  await expect(jane).toHaveCount(0);
  await pick(teams, 'Team', 'Z Cebu');
  await expect(jane).toBeVisible();
  await action(jane, 'Move').click();
  await save(page, 'Move Member', {
    'Destination Team': `Palawan · ${paymentsArt}`,
  });
  await pick(teams, 'Team', 'Palawan');
  await expect(jane).toBeVisible();

  const memberUrl = new URL('/api/organization/members', page.url()).href;
  const teamId = await teams.getByLabel('Team', { exact: true }).inputValue();
  const officeRows = (await (
    await page.request.get('/api/organization/locations')
  ).json()) as { code: string; id: string }[];
  const sgId = officeRows.find((location) => location.code === 'SG')!.id;
  await action(members, 'Add Member').click();
  await save(page, 'Add Member', {
    'Full name': 'Scrum Lead',
    Initials: 'SL',
    Role: 'SM',
    Location: 'SG · Singapore',
  });
  for (let index = 0; index < 12; index++) {
    expect(
      (
        await page.request.post(memberUrl, {
          data: {
            teamId,
            locationId: sgId,
            fullName: `Roster Member ${index + 1}`,
            initials: 'RM',
            role: 'Team member',
          },
        })
      ).status(),
    ).toBe(201);
  }
  await page.reload();
  await tab(page, labels.teams).click();
  await pick(teams, 'ART', paymentsArt);
  await expect(members.getByRole('group')).toHaveCount(14);
  await expect(group(members, 'Scrum Lead')).toContainText(
    'Excluded from dev capacity',
  );
  await action(group(teams, 'Palawan'), 'Delete').click();
  await action(group(teams, 'Palawan'), 'Confirm delete').click();
  await expect(group(teams, 'Palawan').getByRole('alert')).toContainText(
    /assignments/i,
  );
  await action(group(teams, 'Palawan'), 'Archive').click();
  await expect(teams.getByRole('option', { name: 'Palawan' })).toHaveCount(0);
  await page.getByLabel('Show archived Teams').check();
  await pick(teams, 'Team', 'Palawan');
  await expect(jane).toBeVisible();
  await action(group(teams, 'Palawan'), 'Reactivate').click();
  await expect(group(teams, 'Palawan')).toContainText('Active');

  await tab(page, labels.locations).click();
  await page.getByLabel('Show archived Locations').check();
  await action(tokyo, 'Reactivate').click();
  await page.getByLabel('Show archived Locations').uncheck();
  await expect(tokyo).toBeVisible();
  await tab(page, labels.cadence).click();
  await pick(arts, 'ART', paymentsArt);
  await pick(iterations, 'Team schedule preview', 'Palawan');
  await expect(group(iterations, 'Sprint 5')).toContainText(
    'Team: 2027-01-01 – 2027-01-14',
  );
  await expect(group(iterations, 'Sprint 5')).toContainText(
    'ART: 2027-01-04 – 2027-01-15',
  );

  for (const width of [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, label] of Object.entries(labels)) {
      await tab(page, label).click();
      if (name === 'cadence') {
        await pick(arts, 'ART', paymentsArt);
        await expect(group(iterations, 'Sprint 5')).toBeVisible();
      } else if (name === 'teams') {
        await pick(teams, 'ART', paymentsArt);
        await expect(jane).toBeVisible();
      } else {
        await expect(tokyo).toBeVisible();
      }
      await checkAxe(page, 'header, main');
      await page.screenshot({
        path: info.outputPath(`${name}-${width}.png`),
        fullPage: true,
      });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
    }
    expect(
      await registry.evaluate(
        (element) => element.scrollWidth <= element.clientWidth,
      ),
    ).toBe(width !== 768);
    await expect(
      registry.getByRole('columnheader', { name: 'Last refreshed' }),
    ).toHaveCSS('white-space', 'nowrap');
    await expect(locations).toHaveCSS('border-radius', '14px');
    await expect(
      registry.getByRole('columnheader', { name: 'Code' }),
    ).toHaveCSS('background-color', 'rgb(250, 248, 245)');
  }

  await page.goto('/');
  const breadcrumb = page.getByRole('navigation', { name: 'Context' });
  const today = page.getByTestId('today-widget');
  const teamPicker = breadcrumb.getByRole('button', { name: /Switch Team/i });
  const piPicker = breadcrumb.getByRole('button', { name: /Switch PI/i });
  await teamPicker.click();
  const teamMenu = page.getByRole('menu', { name: 'Switch Team' });
  await expect(teamMenu.getByRole('group', { name: spareArt })).toHaveCount(0);
  const paymentTeams = teamMenu.getByRole('group', { name: paymentsArt });
  await paymentTeams.getByRole('menuitemradio', { name: 'Z Cebu' }).click();
  await expect(
    breadcrumb.getByRole('link', { name: paymentsArt }),
  ).toHaveAttribute('href', '/program-board');
  await expect(today).toContainText('PI-2027.1 · No active Sprint');
  await piPicker.click();
  await page.getByRole('menuitemradio', { name: /PI-2027.2/ }).click();
  await page.reload();
  await expect(teamPicker).toHaveAccessibleName(/Z Cebu/);
  await expect(piPicker).toHaveAccessibleName(/PI-2027.2/);
  await teamPicker.click();
  await paymentTeams.getByRole('menuitemradio', { name: 'Palawan' }).click();
  await piPicker.click();
  await page.getByRole('menuitemradio', { name: /PI-2027.1/ }).click();
  await expect(today).toContainText('PI-2027.1 · Sprint 5');
  for (const width of [1440, 1024, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() =>
        piPicker
          .getByText('PI-2027.1', { exact: true })
          .evaluate((label) => label.scrollWidth <= label.clientWidth),
      )
      .toBe(true);
    await checkAxe(page, 'header');
  }
  await profile(page).click();
  const account = page.getByRole('menu', { name: 'Account' });
  await expect(account).toContainText(`Palawan · ${paymentsArt}`);
  await account.getByRole('menuitem', { name: 'Organization' }).click();
  await expect(page).toHaveURL(/\/organization$/);
  await profile(page).click();
  await expect(account).toContainText(`Palawan · ${paymentsArt}`);
  expect(external).toEqual([]);
});
