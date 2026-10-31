// «Copia de seguridad» in Ajustes: the status card (guest and signed in), the drop area, the folded paste and the
// result box. The reminder above the offers is in ui.spec.js.

import { installFake, withoutProject, withProject } from './fake-account.js';
import { expect, loadOffers, sample, test } from './fixtures.js';

const result = (page) => page.locator('#backupResult');
const backupText = JSON.stringify({ offers: sample.offers.slice(0, 2), cfg: sample.cfg });

/** Ajustes, as a guest of a project, or as a member of it, or with no project. */
async function openSettings(openApp, who) {
  const page =
    who === 'none'
      ? await openApp({ beforeLoad: withoutProject })
      : await openApp({
          init: installFake,
          arg: who === 'member' ? { tables: { profiles: [{ user_id: 'x', sharing: false }] } } : { signedOut: true },
          beforeLoad: withProject,
        });
  await page.evaluate(() => app.openSettingsPage());
  return page;
}

test.describe('the status card', () => {
  test('a guest is told when the last copy was made and that the browser can delete the offers', async ({
    openApp,
  }) => {
    const page = await openSettings(openApp, 'guest');
    await loadOffers(page, sample);
    await expect(page.locator('#backupStatus')).toHaveText('Aún no has guardado ninguna copia.');
    await expect(page.locator('#backupStatus')).toHaveClass(/warn/);
    await expect(page.locator('#backupAdvice')).toContainText(
      'El navegador puede borrar tus ofertas: guarda una copia',
    );
    await expect(page.locator('#backupAccount')).toBeHidden();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Descargar copia', exact: true }).last().click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.json$/);
    await expect(page.locator('#backupStatus')).toContainText('Última copia: hoy');
    await expect(page.locator('#backupStatus')).toHaveClass(/ok/);
    await expect(page.locator('#backupAdvice')).toContainText('Incluye todo lo que tienes ahora');
    await expect(page.locator('#backupSaveResult')).toContainText('Copia guardada');
    await expect(result(page)).toBeHidden();

    await page.evaluate(() => {
      app.state.offers[0].mine.name = 'Cambiada';
    });
    await page.evaluate(async () => (await import('./src/views/settings.js')).paintBackup());
    await expect(page.locator('#backupAdvice')).toContainText('Has cambiado ofertas desde entonces');
    await expect(page.locator('#backupStatus')).toHaveClass(/warn/);
  });

  test('signed in, the card says the offers are in the account and a file is an extra', async ({ openApp }) => {
    const page = await openSettings(openApp, 'member');
    await expect(page.locator('#backupAccount')).toContainText('Tus ofertas se guardan en tu cuenta.');
    await expect(page.locator('#backupAccount')).toContainText('Una copia en archivo es un respaldo extra');
    await expect(page.locator('#backupGuest')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Descargar copia' }).last()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copiar como texto' })).toBeVisible();
  });

  test('without a project it is the guest card', async ({ openApp }) => {
    const page = await openSettings(openApp, 'none');
    await expect(page.locator('#backupGuest')).toBeVisible();
    await expect(page.locator('#backupAccount')).toBeHidden();
  });
});

test.describe('recovering a copy', () => {
  test('the file can be picked or dropped on the area; the result is a visible success box', async ({ openApp }) => {
    const page = await openSettings(openApp, 'none');
    await expect(page.locator('#backupDrop')).toContainText('o arrástralo aquí');
    await expect(page.locator('#backupDrop #backupFile')).toHaveCount(1);
    await expect(result(page)).toBeHidden();
    await page.evaluate((text) => {
      const data = new DataTransfer();
      data.items.add(new File([text], 'copia.json', { type: 'application/json' }));
      document
        .getElementById('backupDrop')
        .dispatchEvent(new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }));
    }, backupText);
    await expect(result(page)).toBeVisible();
    await expect(result(page)).toHaveText(/^Añadidas 2 ofertas/);
    await expect(result(page)).toHaveAttribute('data-kind', 'ok');
    expect(await page.evaluate(() => app.state.offers.length)).toBe(2);
  });

  test('an offer-less result is a warning: nothing added, or not a copy', async ({ openApp }) => {
    const page = await openSettings(openApp, 'none');
    await page.setInputFiles('#backupFile', {
      name: 'copia.json',
      mimeType: 'application/json',
      buffer: Buffer.from(backupText),
    });
    await expect(result(page)).toHaveAttribute('data-kind', 'ok');
    await page.setInputFiles('#backupFile', {
      name: 'copia.json',
      mimeType: 'application/json',
      buffer: Buffer.from(backupText),
    });
    await expect(result(page)).toHaveAttribute('data-kind', 'warn');
    await expect(result(page)).toContainText('No se ha añadido ninguna oferta');
    await page.setInputFiles('#backupFile', {
      name: 'x.json',
      mimeType: 'application/json',
      buffer: Buffer.from('hola'),
    });
    await expect(result(page)).toHaveAttribute('data-kind', 'warn');
    await expect(result(page)).toContainText('Eso no es una copia válida');
  });

  test('pasting is folded away: the text is recovered from «Pegar el texto de una copia»', async ({ openApp }) => {
    const page = await openSettings(openApp, 'none');
    await expect(page.locator('#backupPaste')).toBeHidden();
    await page.getByText('Pegar el texto de una copia').click();
    await expect(page.locator('#backupPaste')).toBeVisible();
    await page.getByRole('button', { name: 'Recuperar este texto' }).click();
    await expect(result(page)).toHaveAttribute('data-kind', 'warn');
    await expect(result(page)).toContainText('Pega antes el texto');
    await page.fill('#backupPaste', 'no es una copia');
    await page.getByRole('button', { name: 'Recuperar este texto' }).click();
    await expect(result(page)).toContainText('Eso no es una copia válida');
    await page.fill('#backupPaste', backupText);
    await page.getByRole('button', { name: 'Recuperar este texto' }).click();
    await expect(result(page)).toHaveAttribute('data-kind', 'ok');
    await expect(result(page)).toHaveText(/^Añadidas 2 ofertas/);
    await expect(page.locator('#backupPaste')).toHaveValue('');
  });
});

test('the backup box styling stays off the offer result, and nothing-added keeps the first-run state', async ({
  openApp,
}) => {
  const page = await openSettings(openApp, 'none');
  const placeholder = await page.evaluate(() => app.state.placeholderId);
  expect(placeholder).toBeTruthy();
  const empty = JSON.stringify({ offers: [], cfg: sample.cfg });
  await page.setInputFiles('#backupFile', { name: 'c.json', mimeType: 'application/json', buffer: Buffer.from(empty) });
  await expect(result(page)).toHaveAttribute('data-kind', 'warn');
  await expect(result(page)).toContainText('Se han tomado tus datos de la copia');
  expect(await page.evaluate(() => app.state.placeholderId)).toBe(placeholder);
  const style = await page.evaluate(() => {
    const css = getComputedStyle(document.getElementById('result'));
    return [css.backgroundColor, css.borderTopWidth];
  });
  expect(style).toEqual(['rgba(0, 0, 0, 0)', '0px']);
});

test('a file dropped on the paste box is loaded, not opened by the browser', async ({ openApp }) => {
  const page = await openSettings(openApp, 'none');
  await page.getByText('Pegar el texto de una copia').click();
  const prevented = await page.evaluate((text) => {
    const data = new DataTransfer();
    data.items.add(new File([text], 'copia.json', { type: 'application/json' }));
    const event = new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true });
    document.getElementById('backupPaste').dispatchEvent(event);
    return event.defaultPrevented;
  }, backupText);
  expect(prevented).toBe(true);
  await expect(result(page)).toHaveText(/^Añadidas 2 ofertas/);
});
