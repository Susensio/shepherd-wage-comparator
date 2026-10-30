// The «Cuenta» section of Ajustes, against a fake supabase-js client: no real project is needed.
//
// The fake client and its seam are in fake-account.js.

import { installFake, withoutProject, withProject } from './fake-account.js';
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

test('with no project configured the section is hidden', async ({ openApp }) => {
  const page = await openApp({ beforeLoad: withoutProject });
  await page.evaluate(() => app.showTab('settings'));
  await expect(page.locator('#account')).toBeHidden();
});

test('signed out: what an account gives, and Google through the redirect when its script does not load', async ({
  openApp,
}) => {
  const page = await openAccount(openApp, { signedOut: true });
  await expect(page.locator('#account')).toBeVisible();
  await expect(page.locator('#accountOut')).toContainText('cualquier dispositivo');
  await expect(page.locator('#accountOut')).toContainText('compartiendo las tuyas');
  await expect(page.locator('#accountIn')).toBeHidden();
  await page.locator('#accountOut').getByRole('button', { name: 'Continuar con Google' }).click();
  await expect.poll(() => page.evaluate(() => window.fake.oauth?.provider)).toBe('google');
});

test.describe('the sign-in card', () => {
  /** The page on Ofertas, signed out. */
  const openCard = (openApp, options = {}) =>
    openApp({
      init: installFake,
      arg: { signedOut: true, tables: { profiles: [{ ...PROFILE }], offers: [], offer_mine: [] }, ...options },
      beforeLoad: withProject,
    });

  test("heads the page, with Google's button and its account chooser", async ({ openApp }) => {
    const page = await openCard(openApp, { google: true });
    const card = page.locator('#signInCard');
    await expect(card).toBeVisible();
    await expect(card).toContainText('desde cualquier dispositivo');
    await expect.poll(() => page.evaluate(() => window.fake.google.prompts)).toBe(1);
    await card.getByRole('button', { name: 'Google (falso)' }).click();
    await expect(card).toBeHidden();
    const { idToken, google } = await page.evaluate(() => window.fake);
    expect(idToken.token).toBe('google-jwt');
    const hashed = await page.evaluate(async (raw) => {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }, idToken.nonce);
    expect(hashed).toBe(google.nonce);
    await page.evaluate(() => app.showTab('settings'));
    await expect(page.locator('#accountWho')).toContainText('Ana Pastora');
  });

  test('signs in with a code sent by email', async ({ openApp }) => {
    const page = await openCard(openApp);
    const card = page.locator('#signInCard');
    await card.getByLabel('Tu correo').fill('ana@example.com');
    await card.getByRole('button', { name: 'Enviarme un código' }).click();
    await expect(card).toContainText('Se ha enviado un código a ana@example.com');
    expect(await page.evaluate(() => window.fake.otp.email)).toBe('ana@example.com');

    await card.getByLabel('Código').fill('999999');
    await card.getByRole('button', { name: 'Entrar' }).click();
    await expect(card).toContainText('El código no vale');

    await card.getByLabel('Código').fill('123456');
    await card.getByLabel('Código').press('Enter');
    await expect(card).toBeHidden();
  });

  test('«Continuar sin cuenta» is remembered, and Google is not reached again', async ({ openApp }) => {
    const page = await openCard(openApp);
    await page.getByRole('button', { name: 'Continuar sin cuenta' }).click();
    await expect(page.locator('#signInCard')).toBeHidden();
    const google = [];
    page.on('request', (request) => request.url().includes('accounts.google.com') && google.push(request.url()));
    await page.reload();
    await page.waitForFunction(() => window.app);
    await page.waitForTimeout(300); // the card would show once the start-up has looked for a session
    await expect(page.locator('#signInCard')).toBeHidden();
    expect(google).toEqual([]);
  });
});

test.describe('first sign-in with offers only in this browser', () => {
  const open = (openApp, options = {}) =>
    openAccount(openApp, {
      tables: { profiles: [{ ...PROFILE }], ...accountRows() },
      localOffers: sample.offers,
      ...options,
    });

  test('they are uploaded without asking, beside the account offers', async ({ openApp }) => {
    const page = await open(openApp);
    await expect(page.locator('#accountIn')).toBeVisible();
    await expect(page.locator('#accountPending')).toBeHidden();
    expect(await page.evaluate(() => window.fake.data.offers.length)).toBe(sample.offers.length + 1);
    expect(await page.evaluate(() => app.state.offers.length)).toBe(sample.offers.length + 1);
  });

  test('a failed upload lists them; retrying keeps both', async ({ openApp }) => {
    const page = await open(openApp, { failUpload: true });
    await expect(page.locator('#accountPending')).toBeVisible();
    await expect(page.locator('#pendingList li')).toHaveCount(sample.offers.length);
    await expect(page.locator('#accountIn')).toBeHidden();
    await page.getByRole('button', { name: 'Volver a intentarlo' }).click();
    await expect(page.locator('#accountIn')).toBeVisible();
    expect(await page.evaluate(() => window.fake.data.offers.length)).toBe(sample.offers.length + 1);
  });

  test('after a failed upload, keeping only the account discards them', async ({ openApp }) => {
    const page = await open(openApp, { failUpload: true });
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
  await page.evaluate(() => app.showTab('offers'));
  await expect(page.locator('#signInCard')).toBeHidden();
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
