// The account, against a fake supabase-js client: no real project is needed. The app bar's account button (absent
// without a project) with its status, the page it opens, the settings page of the cog, and the tooltip that leads to
// the account page (ADR-0009, ADR-0011).
//
// The fake client and its seam are in fake-account.js.

import { installFake, withoutProject, withProject } from './fake-account.js';
import { expect, sample, test } from './fixtures.js';

/** The fake's signed-in user; `installFake` runs in the page, so it repeats the literal. */
const ME = '00000000-0000-0000-0000-00000000000a';
const ACCOUNT_OFFER = '10000000-0000-0000-0000-000000000001';
const PROFILE = { user_id: ME, name: 'Ana Pastora', email: 'ana@example.com', phone: null, sharing: false };

/** The page on the account page, with the fake account. */
async function openAccount(openApp, options = {}) {
  const arg = {
    tables: { profiles: [{ ...PROFILE }], offers: [], offer_mine: [] },
    ...options,
  };
  const page = await openApp({ init: installFake, arg, beforeLoad: withProject });
  await page.evaluate(() => app.openAccountPage());
  return page;
}

const accountRows = () => ({
  offers: [{ id: ACCOUNT_OFFER, user_id: ME, terms: {} }],
  offer_mine: [{ offer_id: ACCOUNT_OFFER, mine: { name: 'De la cuenta' }, cmp: true }],
});

test('with no project configured: only the cog shows, it opens the settings, and nothing asks to sign in', async ({
  openApp,
}) => {
  const page = await openApp({ beforeLoad: withoutProject });
  await expect(page.locator('#accountButton')).toBeHidden();
  await expect(page.locator('#accountTip .tip')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await expect(page.locator('[data-panel=settings] h2')).toHaveText('Ajustes');
  await expect(page.locator('#yourdata')).toBeVisible();
  await expect(page.locator('#settingsStorage')).toBeHidden();
  await expect(page.locator('[data-panel=account]')).toBeHidden();
});

test('signed out: the account page lists how to sign in, with Google through the redirect when its script does not load', async ({
  openApp,
}) => {
  const page = await openAccount(openApp, { signedOut: true });
  await expect(page.locator('[data-panel=account] h2')).toHaveText('Cuenta');
  await expect(page.locator('#account')).toBeVisible();
  await expect(page.locator('#account summary')).toHaveCount(0); // one heading: «Cuenta»
  await expect(page.locator('#accountOut')).toContainText('cualquier dispositivo');
  await expect(page.locator('#accountOut')).toContainText('Si compartes las tuyas');
  await expect(page.locator('#accountIn')).toBeHidden();
  await page.locator('#accountOut').getByRole('button', { name: 'Continuar con Google' }).click();
  await expect.poll(() => page.evaluate(() => window.fake.oauth?.provider)).toBe('google');
});

test.describe('the settings page', () => {
  const storage = (page) => page.locator('#settingsStorage');

  test('the cog opens «Ajustes», with the data, the assumptions and the backup, and none of the account', async ({
    openApp,
  }) => {
    const page = await openApp({ init: installFake, arg: { signedOut: true }, beforeLoad: withProject });
    await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
    await expect(page.locator('[data-panel=settings] h2')).toHaveText('Ajustes');
    await expect(page.locator('.tabs')).toBeHidden();
    for (const id of ['#yourdata', '#assumptions', '#backup']) await expect(page.locator(id)).toBeVisible();
    await expect(page.locator('[data-panel=account]')).toBeHidden();
    await expect(page.locator('#account')).toBeHidden();
  });

  test('says where the settings are kept: the browser for a guest, the account when signed in', async ({ openApp }) => {
    const guest = await openApp({ init: installFake, arg: { signedOut: true }, beforeLoad: withProject });
    await guest.evaluate(() => app.openSettingsPage());
    await expect(storage(guest)).toHaveText('Se guardan solo en este navegador.');
    const member = await openApp({
      init: installFake,
      arg: { tables: { profiles: [{ ...PROFILE }] } },
      beforeLoad: withProject,
    });
    await member.evaluate(() => app.openSettingsPage());
    await expect(storage(member)).toHaveText('Se guardan en tu cuenta.');
  });

  test('the account page holds the account and none of the settings', async ({ openApp }) => {
    const page = await openAccount(openApp);
    await expect(page.locator('#accountIn')).toBeVisible();
    for (const id of ['#yourdata', '#assumptions', '#backup', '#settingsStorage'])
      await expect(page.locator(id)).toBeHidden();
  });

  test('the cog on the account page switches to the settings, and one «Volver» leaves both', async ({ openApp }) => {
    const page = await openAccount(openApp);
    await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
    await expect(page.locator('[data-panel=settings]')).toBeVisible();
    await expect(page.locator('[data-panel=account]')).toBeHidden();
    await page
      .locator('[data-panel=settings]')
      .getByRole('button', { name: /Volver/ })
      .click();
    await expect(page.locator('[data-panel=offers]')).toBeVisible();
  });
});

test.describe('the account button', () => {
  const open = (openApp, options = {}) =>
    openApp({
      init: installFake,
      arg: { localOffers: sample.offers, tables: { profiles: [{ ...PROFILE }], ...accountRows() }, ...options },
      beforeLoad: withProject,
    });
  const button = (page) => page.locator('#accountButton');

  test('a guest has a person and an amber dot', async ({ openApp }) => {
    const page = await open(openApp, { signedOut: true });
    await expect(button(page)).toHaveAttribute('data-status', 'guest');
    await expect(button(page).locator('.ic-person')).toBeVisible();
    await expect(button(page).locator('.status-dot')).toBeVisible();
    await expect(button(page)).toHaveAttribute('aria-label', /Entrar\. Tus ofertas solo están/);
  });

  test('signed in: the initials, and the status in words', async ({ openApp }) => {
    const page = await open(openApp);
    await expect(button(page).locator('.initials')).toHaveText('AP');
    await expect(button(page)).toHaveAttribute('data-status', 'online');
    await expect(button(page)).toHaveAttribute('aria-label', /Conectado/);
    await page.context().setOffline(true);
    await page.evaluate(() => dispatchEvent(new Event('offline')));
    await expect(button(page)).toHaveAttribute('data-status', 'offline');
    await expect(button(page)).toHaveAttribute('aria-label', /Sin conexión/);
    await page.context().setOffline(false);
    await page.evaluate(() => dispatchEvent(new Event('online')));
    await expect(button(page)).toHaveAttribute('data-status', 'online');
  });

  test('the initials come from the email when there is no name', async ({ openApp }) => {
    const page = await open(openApp, { tables: { profiles: [{ ...PROFILE, name: null }], ...accountRows() } });
    await expect(button(page).locator('.initials')).toHaveText('A');
  });

  test('a name of only spaces falls back to the person icon', async ({ openApp }) => {
    const page = await open(openApp, { tables: { profiles: [{ ...PROFILE, name: '   ' }], ...accountRows() } });
    await expect(button(page)).toHaveAttribute('data-kind', 'person');
    await expect(button(page).locator('.initials')).toHaveText('');
  });

  test('the initials take whole characters', async ({ openApp }) => {
    const page = await open(openApp, { tables: { profiles: [{ ...PROFILE, name: '😀 Ñandú' }], ...accountRows() } });
    await expect(button(page).locator('.initials')).toHaveText('😀Ñ');
  });

  test('a failed first upload is amber, in words', async ({ openApp }) => {
    const page = await open(openApp, { failUpload: true });
    await expect(button(page)).toHaveAttribute('data-status', 'pending');
    await expect(button(page)).toHaveAttribute('aria-label', /No se pudieron subir/);
  });

  test('it opens the account page, and «Volver» returns to the tab it came from', async ({ openApp }) => {
    const page = await open(openApp);
    await page.locator('.tabs [data-tab=laws]').click();
    await button(page).click();
    await expect(page.locator('[data-panel=account]')).toBeVisible();
    await expect(page.locator('.tabs')).toBeHidden();
    await expect(page.locator('[data-panel=laws]')).toBeHidden();
    await page.getByRole('button', { name: 'Volver' }).click();
    await expect(page.locator('[data-panel=laws]')).toBeVisible();
    await expect(page.locator('.tabs')).toBeVisible();
    await expect(page.locator('[data-panel=account]')).toBeHidden();
  });

  test('the app bar is on the welcome too, and a stored «settings» tab opens Ofertas', async ({ openApp }) => {
    const page = await openApp({ init: installFake, arg: { signedOut: true }, beforeLoad: withProject });
    await expect(page.locator('#welcome')).toBeVisible();
    await expect(page.locator('.appbar h1')).toHaveText('Comparador de jornales');
    await expect(page.locator('.appbar .kicker')).toHaveText('Para pastores y pastoras');
    await expect(page.getByRole('button', { name: 'Ajustes', exact: true })).toBeVisible();
    await expect(button(page)).toBeVisible();
    await page.evaluate(() => localStorage.setItem('cj.tab', 'settings'));
    await page.reload();
    await page.waitForFunction(() => window.app);
    await expect(page.locator('.tabs [data-tab=offers]')).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('the tooltip', () => {
  /** The page on Ofertas, signed out, with offers in the browser (a first visit has the welcome instead). */
  const openGuest = (openApp, options = {}) =>
    openApp({
      init: installFake,
      arg: {
        signedOut: true,
        localOffers: sample.offers,
        tables: { profiles: [{ ...PROFILE }], offers: [], offer_mine: [] },
        ...options,
      },
      beforeLoad: withProject,
    });
  const tip = (page) => page.locator('#accountTip .tip');

  test('shows on Ofertas, Comparar and Ajustes, each with its own message; not on Leyes or the account page', async ({
    openApp,
  }) => {
    const page = await openGuest(openApp);
    await expect(tip(page)).toContainText('Guarda tus ofertas en una cuenta. Ahora solo están en este navegador.');
    await page.locator('.tabs [data-tab=compare]').click();
    await expect(tip(page)).toContainText('Compara con otros pastores.');
    await page.locator('.tabs [data-tab=laws]').click();
    await expect(tip(page)).toHaveCount(0);
    await page.evaluate(() => app.openSettingsPage());
    await expect(tip(page)).toContainText('Guarda tus ajustes en una cuenta.');
    await page.locator('#accountButton').click();
    await expect(tip(page)).toHaveCount(0);
  });

  test('shows on the welcome', async ({ openApp }) => {
    const page = await openGuest(openApp, { localOffers: undefined });
    await expect(page.locator('#welcome')).toBeVisible();
    await expect(tip(page)).toBeVisible();
    await expect(page.locator('#accountButton')).toBeVisible();
  });

  test('«Ahora no» on any of them hides it everywhere for the visit; it is back after a reload', async ({
    openApp,
  }) => {
    const page = await openGuest(openApp);
    await page.locator('.tabs [data-tab=compare]').click();
    await tip(page).getByRole('button', { name: 'Ahora no' }).click();
    await expect(tip(page)).toHaveCount(0);
    await page.locator('.tabs [data-tab=offers]').click();
    await expect(tip(page)).toHaveCount(0);
    await page.evaluate(() => app.openSettingsPage());
    await expect(tip(page)).toHaveCount(0);
    await expect(page.locator('#accountButton')).toHaveAttribute('data-status', 'guest');
    await page.reload();
    await page.waitForFunction(() => window.app);
    await expect(tip(page)).toBeVisible();
  });

  test('signing in from the tooltip on Ajustes goes back to Ajustes', async ({ openApp }) => {
    const page = await openGuest(openApp, { google: true });
    await page.evaluate(() => app.openSettingsPage());
    await tip(page).getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('[data-panel=account]')).toBeVisible();
    await page.locator('#accountOut').getByRole('button', { name: 'Google (falso)' }).click();
    await expect(page.locator('[data-panel=settings]')).toBeVisible();
    await expect(page.locator('#accountButton')).toHaveAttribute('data-status', 'online');
  });

  test('«Entrar» opens the page, with its sign-in', async ({ openApp }) => {
    const page = await openGuest(openApp);
    await tip(page).getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('[data-panel=account]')).toBeVisible();
    await expect(page.locator('#accountOut')).toBeVisible();
  });

  test("signing in from it returns to the tab, after Google's account chooser", async ({ openApp }) => {
    const page = await openGuest(openApp, { google: true });
    await page.locator('.tabs [data-tab=offers]').click();
    await tip(page).getByRole('button', { name: 'Entrar' }).click();
    await expect.poll(() => page.evaluate(() => window.fake.google.prompts)).toBe(1);
    await page.locator('#accountSignIn').getByRole('button', { name: 'Google (falso)' }).click();
    await expect(page.locator('[data-panel=offers]')).toBeVisible();
    await expect(page.locator('#accountButton .initials')).toHaveText('AP');
    const { idToken, google } = await page.evaluate(() => window.fake);
    expect(idToken.token).toBe('google-jwt');
    const hashed = await page.evaluate(async (raw) => {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
      return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }, idToken.nonce);
    expect(hashed).toBe(google.nonce);
    await expect(tip(page)).toHaveCount(0);
  });

  test('signing in from the button stays on the page', async ({ openApp }) => {
    const page = await openGuest(openApp, { google: true });
    await page.locator('#accountButton').click();
    await page.locator('#accountSignIn').getByRole('button', { name: 'Google (falso)' }).click();
    await expect(page.locator('#accountWho')).toContainText('Ana Pastora');
    await expect(page.locator('[data-panel=account]')).toBeVisible();
  });

  test('signs in with a code sent by email', async ({ openApp }) => {
    const page = await openGuest(openApp);
    await page.locator('#accountButton').click();
    const form = page.locator('#accountSignIn');
    await form.getByLabel('Tu correo').fill('ana@example.com');
    await form.getByRole('button', { name: 'Enviar un código' }).click();
    await expect(form).toContainText('Se ha enviado un código a ana@example.com');
    expect(await page.evaluate(() => window.fake.otp.email)).toBe('ana@example.com');

    await form.getByLabel('Código').fill('999999');
    await form.getByRole('button', { name: 'Entrar' }).click();
    await expect(form).toContainText('El código no es correcto');

    await form.getByLabel('Código').fill('123456');
    await form.getByLabel('Código').press('Enter');
    await expect(page.locator('#accountWho')).toBeVisible();
  });

  test('«Enviar otro código» sends another to the same address', async ({ openApp }) => {
    const page = await openGuest(openApp);
    await page.locator('#accountButton').click();
    const form = page.locator('#accountSignIn');
    await form.getByLabel('Tu correo').fill('ana@example.com');
    await form.getByRole('button', { name: 'Enviar un código' }).click();
    await form.getByRole('button', { name: 'Enviar otro código' }).click();
    await expect(form).toContainText('Se ha enviado otro código.');
    expect(await page.evaluate(() => window.fake.otps.map((otp) => otp.email))).toEqual([
      'ana@example.com',
      'ana@example.com',
    ]);
    await form.getByLabel('Código').fill('123456');
    await form.getByLabel('Código').press('Enter');
    await expect(page.locator('#accountWho')).toBeVisible();
  });

  test("Google's button is the white one in dark mode too, on a transparent frame", async ({ openApp }) => {
    const page = await openGuest(openApp, { google: true });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.locator('#accountButton').click();
    await expect.poll(() => page.evaluate(() => window.fake.google.themes.at(-1))).toBe('outline');
    const scheme = await page.locator('#accountOut .gsi-slot').evaluate((slot) => getComputedStyle(slot).colorScheme);
    expect(scheme).toBe('light');
  });

  test('the backup reminder gives way to the account', async ({ openApp }) => {
    const page = await openGuest(openApp);
    await expect(page.locator('#backupNotice')).toBeHidden();
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
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.locator('#accountIn')).toBeVisible();
    expect(await page.evaluate(() => window.fake.data.offers.length)).toBe(sample.offers.length + 1);
  });

  test('after a failed upload, keeping only the account discards them', async ({ openApp }) => {
    const page = await open(openApp, { failUpload: true });
    await page.getByRole('button', { name: 'Descartar estas ofertas' }).click();
    await expect(page.locator('#accountIn')).toBeVisible();
    expect(await page.evaluate(() => window.fake.data.offers.length)).toBe(1);
    expect(await page.evaluate(() => app.state.offers.map((o) => o.id))).toEqual([ACCOUNT_OFFER]);
  });
});

test('signed in: who, and signing out', async ({ openApp }) => {
  const page = await openAccount(openApp);
  await expect(page.locator('#accountWho')).toHaveText('Has entrado como Ana Pastora.');
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.locator('#accountOut')).toBeVisible();
  await expect(page.locator('#accountIn')).toBeHidden();
  expect(await page.evaluate(() => window.fake.signedOut)).toBe(true);
  await page.evaluate(() => app.showTab('offers'));
  await expect(page.locator('#accountTip .tip')).toHaveCount(0); // signing out is not asked about again this visit
});

test('signed in: deleting the account is a section of its own, after «Otros pastores»', async ({ openApp }) => {
  const page = await openAccount(openApp);
  const headings = await page.locator('#accountIn h4').allTextContents();
  expect(headings).toEqual(['Tu perfil', 'Otros pastores', 'Borrar la cuenta']);
  const under = await page.evaluate(() => {
    const heading = [...document.querySelectorAll('#accountIn h4')].find((h) => h.textContent === 'Borrar la cuenta');
    const sharing = document.querySelector('#profSharing').getBoundingClientRect();
    const button = document.querySelector('[data-action=askDeleteAccount]').getBoundingClientRect();
    return heading.getBoundingClientRect().top > sharing.bottom && button.top > heading.getBoundingClientRect().bottom;
  });
  expect(under).toBe(true);
});

test('signing out clears the browser copy, shows the welcome and says the offers are in the account', async ({
  openApp,
}) => {
  const page = await openApp({
    init: installFake,
    arg: { localOffers: sample.offers, tables: { profiles: [{ ...PROFILE }], ...accountRows() } },
    beforeLoad: withProject,
  });
  await page.evaluate(() => app.openAccountPage());
  const inAccount = await page.evaluate(() => window.fake.data.offers.map((o) => o.id));
  await page.getByRole('button', { name: 'Salir' }).click();
  await expect(page.locator('#accountMsg')).toHaveText('Tus ofertas siguen guardadas en tu cuenta. Entra para verlas.');
  await page.getByRole('button', { name: 'Volver' }).first().click();
  await expect(page.locator('#welcome')).toBeVisible();
  await expect(page.locator('#signedOutNotice')).toHaveText(
    'Tus ofertas siguen guardadas en tu cuenta. Entra para verlas.',
  );
  expect(await page.evaluate(() => app.state.offers.length)).toBe(1);
  expect(await page.evaluate(() => app.state.placeholderId)).not.toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cj.ofertas2')))).toBeNull(); // a first visit on reload
  expect(await page.evaluate(() => window.fake.data.offers.map((o) => o.id))).toEqual(inAccount); // nothing deleted
});

test('signed in: online on the button and in the section, and no tooltip', async ({ openApp }) => {
  const page = await openAccount(openApp, { tables: { profiles: [{ ...PROFILE }], ...accountRows() } });
  await expect(page.locator('#accountButton')).toHaveAttribute('data-status', 'online');
  await expect(page.locator('#accountSync')).toContainText('se guardan en tu cuenta');
  await expect(page.locator('#accountTitle')).toBeHidden();
  await page.evaluate(() => app.showTab('offers'));
  await expect(page.locator('#accountTip .tip')).toHaveCount(0);
});

test('an empty account opens the templates, like a first visit', async ({ openApp }) => {
  const page = await openApp({
    init: installFake,
    arg: { tables: { profiles: [{ ...PROFILE }] } },
    beforeLoad: withProject,
  });
  await expect(page.locator('#welcome')).toBeVisible();
  await expect(page.locator('#tplGrid button').first()).toBeVisible();
});

test('a failed first upload: a tooltip on Ofertas that leads to it, and cannot be sent away', async ({ openApp }) => {
  const page = await openApp({
    init: installFake,
    arg: { tables: { profiles: [{ ...PROFILE }], ...accountRows() }, localOffers: sample.offers, failUpload: true },
    beforeLoad: withProject,
  });
  const tip = page.locator('#accountTip .tip');
  await expect(page.locator('#accountButton')).toHaveAttribute('data-status', 'pending');
  await expect(tip).toContainText('No se pudieron subir tus ofertas a la cuenta.');
  await expect(tip.getByRole('button', { name: 'Ahora no' })).toHaveCount(0);
  await page.locator('.tabs [data-tab=compare]').click();
  await expect(tip).toHaveCount(0);
  await page.locator('.tabs [data-tab=offers]').click();
  await tip.getByRole('button', { name: 'Revisar' }).click();
  await expect(page.locator('#accountPending')).toBeVisible();
});

test('the profile is edited and saved', async ({ openApp }) => {
  const page = await openAccount(openApp);
  await expect(page.locator('#profName')).toHaveValue('Ana Pastora');
  await page.locator('#profName').fill('Ana P.');
  await page.locator('#profPhone').fill('611 222 333');
  await page.getByRole('button', { name: 'Guardar perfil' }).click();
  await expect(page.locator('#accountMsg')).toHaveText('Perfil guardado.');
  await expect(page.locator('#accountMsg')).toHaveClass(/\bok\b/); // a success is green, not the warning colour
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

test('while the account connects, the backup card shows neither version', async ({ openApp }) => {
  const page = await openApp({
    init: installFake,
    arg: { tables: { profiles: [{ ...PROFILE }], ...accountRows() }, holdSession: true },
    beforeLoad: withProject,
  });
  await page.evaluate(() => app.openSettingsPage());
  await expect(page.locator('#backupGuest')).toBeHidden();
  await expect(page.locator('#backupAccount')).toBeHidden();
  await page.evaluate(() => window.fake.releaseSession());
  await expect(page.locator('#backupAccount')).toBeVisible();
  await expect(page.locator('#backupGuest')).toBeHidden();
});

test('sharing asks first, and turning it off does not', async ({ openApp }) => {
  const page = await openAccount(openApp);
  const sharing = () => page.evaluate(() => window.fake.data.profiles[0].sharing);
  const sw = page.locator('#profSharing');
  await sw.click();
  await expect(page.locator('#shareConfirm')).toBeVisible();
  await expect(page.locator('#shareConfirm')).toContainText('tu nombre, tu correo y tu teléfono');
  await expect(page.locator('#shareConfirm')).toContainText('comparten al menos una oferta');
  await expect(page.locator('#shareConfirm')).toContainText('No se ven tus km');
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
  await expect(page.locator('#sharingState')).toContainText('No compartes tus ofertas');
  expect(await sharing()).toBe(false);
});

test('deleting the account asks first and keeps the browser offers', async ({ openApp }) => {
  const page = await openAccount(openApp, { tables: { profiles: [{ ...PROFILE }], ...accountRows() } });
  const before = await page.evaluate(() => app.state.offers.map((o) => o.id));
  await page.getByRole('button', { name: 'Borrar la cuenta', exact: true }).click();
  await expect(page.locator('#deleteConfirm')).toContainText('para siempre');
  await expect(page.locator('#deleteConfirm')).toContainText('En este navegador se quedan tus ofertas');
  expect(await page.evaluate(() => window.fake.rpc)).toEqual([]);

  await page.getByRole('button', { name: 'Cancelar' }).last().click();
  await expect(page.locator('#deleteConfirm')).toBeHidden();
  expect(await page.evaluate(() => window.fake.rpc)).toEqual([]);

  await page.getByRole('button', { name: 'Borrar la cuenta', exact: true }).click();
  await page.getByRole('button', { name: 'Sí, borrar la cuenta' }).click();
  await expect(page.locator('#accountOut')).toBeVisible();
  expect(await page.evaluate(() => window.fake.rpc)).toEqual(['delete_my_account']);
  expect(await page.evaluate(() => app.state.offers.map((o) => o.id))).toEqual(before);
});

test('signing out from the page opened over Comparar silences the tooltip on every tab', async ({ openApp }) => {
  const page = await openApp({
    init: installFake,
    arg: { localOffers: sample.offers, tables: { profiles: [{ ...PROFILE }], ...accountRows() } },
    beforeLoad: withProject,
  });
  await page.evaluate(() => app.showTab('compare'));
  await page.evaluate(() => app.openAccountPage());
  await page.getByRole('button', { name: 'Salir' }).click();
  await page.evaluate(() => app.showTab('offers'));
  await expect(page.locator('#accountButton')).toHaveAttribute('data-status', 'guest');
  await expect(page.locator('#accountTip .tip')).toHaveCount(0);
});

for (const [name, open] of [
  ['account', () => app.openAccountPage()],
  ['settings', () => app.openSettingsPage()],
]) {
  test.describe(`the ${name} page and the history`, () => {
    const openOnCompare = async (openApp) => {
      const page = await openApp({
        init: installFake,
        arg: { localOffers: sample.offers, tables: { profiles: [{ ...PROFILE }], ...accountRows() } },
        beforeLoad: withProject,
      });
      await page.evaluate(() => app.showTab('compare'));
      await page.evaluate(() => window.scrollTo(0, 200));
      return page;
    };

    test("the browser's Back closes the page, stays in the app, and restores the scroll", async ({ openApp }) => {
      const page = await openOnCompare(openApp);
      const before = await page.evaluate(() => scrollY);
      expect(before).toBeGreaterThan(0);
      const url = page.url();
      await page.evaluate(open); // the bar is not sticky: a click would scroll up first
      await expect(page.locator(`[data-panel=${name}]`)).toBeVisible();
      await page.goBack();
      await expect(page.locator(`[data-panel=${name}]`)).toBeHidden();
      await expect(page.locator('[data-panel=compare]')).toBeVisible();
      expect(page.url()).toBe(url);
      expect(await page.evaluate(() => scrollY)).toBe(before);
    });

    test('«Volver» goes back through the history and restores the scroll', async ({ openApp }) => {
      const page = await openOnCompare(openApp);
      const before = await page.evaluate(() => scrollY);
      const length = await page.evaluate(() => history.length);
      await page.evaluate(open);
      await page
        .getByRole('button', { name: /Volver/ })
        .first()
        .click();
      await expect(page.locator('[data-panel=compare]')).toBeVisible();
      expect(await page.evaluate(() => scrollY)).toBe(before);
      await expect.poll(() => page.evaluate(() => history.state?.page ?? false)).toBe(false);
      expect(await page.evaluate(() => history.length)).toBe(length + 1); // the entry stays forward, not stacked
    });
  });
}

test('the cog opens the settings from the app bar, over the tab shown', async ({ openApp }) => {
  const page = await openApp({
    init: installFake,
    arg: { localOffers: sample.offers, signedOut: true },
    beforeLoad: withProject,
  });
  await page.locator('.tabs [data-tab=laws]').click();
  await page.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await expect(page.locator('[data-panel=settings]')).toBeVisible();
  await page.goBack();
  await expect(page.locator('[data-panel=laws]')).toBeVisible();
});
