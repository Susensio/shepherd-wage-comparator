// The «Cuenta» section of Ajustes, against a fake supabase-js client: no real project is needed.
//
// The fake client and its seam are in fake-account.js. Without the config route the section stays hidden.

import { installFake, withProject } from './fake-account.js';
import { expect, sample, test } from './fixtures.js';

/** The fake's signed-in user; `installFake` runs in the page, so it repeats the literal. */
const ME = '00000000-0000-0000-0000-00000000000a';
const ACCOUNT_OFFER = '10000000-0000-0000-0000-000000000001';
const PROFILE = { user_id: ME, name: 'Ana Pastora', email: 'ana@example.com', phone: null, sharing: false };

/** The page on the Ajustes tab, with the fake account. */
async function openAccount(openApp, options = {}) {
  const arg = {
    tables: { profiles: [{ ...PROFILE }], offers: [], offer_mine: [] },
    ...options,
  };
  const page = await openApp({ init: installFake, arg, beforeLoad: withProject });
  await page.evaluate(() => app.showTab('settings'));
  return page;
}

const accountRows = () => ({
  offers: [{ id: ACCOUNT_OFFER, user_id: ME, terms: {} }],
  offer_mine: [{ offer_id: ACCOUNT_OFFER, mine: { name: 'De la cuenta' }, cmp: true }],
});

test('with no project configured the section is hidden', async ({ page }) => {
  await page.evaluate(() => app.showTab('settings'));
  await expect(page.locator('#account')).toBeHidden();
});

test('signed out: what an account gives, and the Google button', async ({ openApp }) => {
  const page = await openAccount(openApp, { signedOut: true });
  await expect(page.locator('#account')).toBeVisible();
  await expect(page.locator('#accountOut')).toContainText('cualquier dispositivo');
  await expect(page.locator('#accountOut')).toContainText('compartiendo las tuyas');
  await expect(page.locator('#accountIn')).toBeHidden();
  await page.getByRole('button', { name: 'Entrar con Google' }).click();
  await expect.poll(() => page.evaluate(() => window.fake.oauth?.provider)).toBe('google');
});

test.describe('first sign-in with offers only in this browser', () => {
  const open = (openApp) =>
    openAccount(openApp, { tables: { profiles: [{ ...PROFILE }], ...accountRows() }, localOffers: sample.offers });

  test('the prompt lists them and cannot be skipped', async ({ openApp }) => {
    const page = await open(openApp);
    await expect(page.locator('#accountPending')).toBeVisible();
    await expect(page.locator('#pendingList li')).toHaveCount(sample.offers.length);
    await expect(page.locator('#accountIn')).toBeHidden();
    await expect(page.locator('#accountOut')).toBeHidden();
    await expect(page.locator('#accountPending button')).toHaveCount(2);
  });

  test('uploading them keeps both', async ({ openApp }) => {
    const page = await open(openApp);
    await page.getByRole('button', { name: 'Subirlas a la cuenta' }).click();
    await expect(page.locator('#accountIn')).toBeVisible();
    await expect(page.locator('#accountPending')).toBeHidden();
    expect(await page.evaluate(() => window.fake.data.offers.length)).toBe(sample.offers.length + 1);
    expect(await page.evaluate(() => app.state.offers.length)).toBe(sample.offers.length + 1);
  });

  test('keeping only the account discards them', async ({ openApp }) => {
    const page = await open(openApp);
    await page.getByRole('button', { name: 'Quedarme solo con las de la cuenta' }).click();
    await expect(page.locator('#accountIn')).toBeVisible();
    expect(await page.evaluate(() => window.fake.data.offers.length)).toBe(1);
    expect(await page.evaluate(() => app.state.offers.map((o) => o.id))).toEqual([ACCOUNT_OFFER]);
  });
});

test('signed in: who, and signing out', async ({ openApp }) => {
  const page = await openAccount(openApp);
  await expect(page.locator('#accountWho')).toHaveText('Has entrado como Ana Pastora · ana@example.com.');
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.locator('#accountOut')).toBeVisible();
  await expect(page.locator('#accountIn')).toBeHidden();
  expect(await page.evaluate(() => window.fake.signedOut)).toBe(true);
});

test('the profile is edited and saved', async ({ openApp }) => {
  const page = await openAccount(openApp);
  await expect(page.locator('#profName')).toHaveValue('Ana Pastora');
  await page.locator('#profName').fill('Ana P.');
  await page.locator('#profPhone').fill('611 222 333');
  await page.getByRole('button', { name: 'Guardar perfil' }).click();
  await expect(page.locator('#accountMsg')).toHaveText('Perfil guardado.');
  const row = await page.evaluate(() => window.fake.data.profiles[0]);
  expect(row).toMatchObject({ name: 'Ana P.', email: 'ana@example.com', phone: '611 222 333' });
});

test('a failed save shows a line, not an alert', async ({ openApp }) => {
  const page = await openAccount(openApp, { failProfile: true });
  page.on('dialog', () => {
    throw new Error('no alert expected');
  });
  await page.getByRole('button', { name: 'Guardar perfil' }).click();
  await expect(page.locator('#accountMsg')).toHaveText('No se pudo guardar el perfil.');
});

test('sharing asks first, and turning it off does not', async ({ openApp }) => {
  const page = await openAccount(openApp);
  const sharing = () => page.evaluate(() => window.fake.data.profiles[0].sharing);
  const sw = page.locator('#profSharing');
  await sw.click();
  await expect(page.locator('#shareConfirm')).toBeVisible();
  await expect(page.locator('#shareConfirm')).toContainText('tu nombre, tu correo y tu teléfono');
  await expect(page.locator('#shareConfirm')).toContainText('también comparta al menos una oferta');
  await expect(page.locator('#shareConfirm')).toContainText('No se muestran tus km');
  expect(await sharing()).toBe(false);
  await expect(sw).not.toBeChecked();

  await page.getByRole('button', { name: 'Cancelar' }).first().click();
  await expect(page.locator('#shareConfirm')).toBeHidden();
  expect(await sharing()).toBe(false);

  await sw.click();
  await page.getByRole('button', { name: 'Sí, compartir' }).click();
  await expect(sw).toBeChecked();
  await expect(page.locator('#shareConfirm')).toBeHidden();
  expect(await sharing()).toBe(true);

  await sw.uncheck();
  await expect(page.locator('#shareConfirm')).toBeHidden();
  await expect(page.locator('#sharingState')).toContainText('no se comparten');
  expect(await sharing()).toBe(false);
});

test('deleting the account asks first and keeps the browser offers', async ({ openApp }) => {
  const page = await openAccount(openApp, { tables: { profiles: [{ ...PROFILE }], ...accountRows() } });
  const before = await page.evaluate(() => app.state.offers.map((o) => o.id));
  await page.getByRole('button', { name: 'Borrar cuenta' }).click();
  await expect(page.locator('#deleteConfirm')).toContainText('para siempre');
  await expect(page.locator('#deleteConfirm')).toContainText('siguen en este navegador');
  expect(await page.evaluate(() => window.fake.rpc)).toEqual([]);

  await page.getByRole('button', { name: 'Cancelar' }).last().click();
  await expect(page.locator('#deleteConfirm')).toBeHidden();
  expect(await page.evaluate(() => window.fake.rpc)).toEqual([]);

  await page.getByRole('button', { name: 'Borrar cuenta' }).click();
  await page.getByRole('button', { name: 'Sí, borrar la cuenta' }).click();
  await expect(page.locator('#accountOut')).toBeVisible();
  expect(await page.evaluate(() => window.fake.rpc)).toEqual(['delete_my_account']);
  expect(await page.evaluate(() => app.state.offers.map((o) => o.id))).toEqual(before);
});
