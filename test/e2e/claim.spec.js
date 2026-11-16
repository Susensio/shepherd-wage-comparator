// «Pedir lo que falta» (ADR-0034): asking the ganadero first and the one line with the deadline; the legal path is the page «Vía legal».

import {
  closeRegistro,
  expect,
  loadOffers,
  openAccounts,
  openLegalPage,
  openRegistro,
  sample,
  test,
} from './fixtures.js';
import { ledgerProblems } from './ledger.js';

const PUERTO_A_OTRA = 1; // 21 June to 30 September 2026
const amount = (text) => Number.parseFloat(text.replace(/[^\d,]/g, '').replace(',', '.'));
const addPayments = (page, list) =>
  page.evaluate(async (list) => {
    const { offers } = await import('./src/offers.js');
    for (const p of list) offers.addPayment(app.active(), p);
    app.select(app.active().id);
  }, list);
const tile = (page, name) => page.locator('.sofar > div', { hasText: name }).locator('b');
const PAID = [{ date: '2026-07-05', amount: 1000, via: 'payroll' }];

test.describe('the ladder', () => {
  test.use({ today: '2026-11-12' });

  test.beforeEach(async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, PAID);
  });

  test('«Hablar con el ganadero»: the summary in net says what the tiles say and ends with the question; it copies', async ({
    page,
  }) => {
    const text = page.locator('details.step[data-step=talk] .claim-text');
    const falta = amount(await tile(page, 'Falta').textContent());
    await expect(text).toContainText('¿Cuándo se puede pagar?');
    const shown = await text.textContent();
    const said = (label) => amount(shown.match(new RegExp(`${label}: ([\\d.,]+)\\s€ netos`))[1]);
    expect(said('Falta')).toBe(falta);
    expect(said('Corresponde')).toBe(amount(await tile(page, 'Corresponde').textContent()));
    expect(said('Cobrado')).toBe(1000);
    // The months listed add up to Falta
    const months = [...shown.matchAll(/^· (?:Junio|Julio|Agosto|Septiembre): ([\d.,]+)\s€/gm)].map((m) => amount(m[1]));
    expect(Math.round(months.reduce((t, x) => t + x, 0) * 100) / 100).toBe(falta);
    await page.locator('details.step[data-step=talk] > summary').click(); // the message is a closed fold
    await page.locator('details.step[data-step=talk] [data-action=copyClaimText]').click();
    await expect(page.locator('details.step[data-step=talk] .copy-msg')).toHaveText('Texto copiado.');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(shown);
  });

  test('without the share sheet there is no «Compartir»; with it, the text goes to it', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Compartir' })).toHaveCount(0);
    await page.evaluate(() => {
      window.shared = [];
      navigator.share = async (data) => {
        window.shared.push(data.text);
      };
      app.select(app.active().id);
    });
    await page.locator('details.step[data-step=talk] > summary').click(); // the message is a closed fold
    await page.locator('details.step[data-step=talk]').getByRole('button', { name: 'Compartir' }).click();
    expect(await page.evaluate(() => window.shared.length)).toBe(1);
    expect(await page.evaluate(() => window.shared[0])).toContain('¿Cuándo se puede pagar?');
  });

  test('«Petición de pago» is not in the main block: it is the formal letter of «Vía legal», dated, in gross, with the pay-by date and the names typed there', async ({
    page,
  }) => {
    await expect(page.locator('#result .ask details.step[data-step=request]')).toHaveCount(0);
    await openLegalPage(page);
    const step = page.locator('details.step[data-step=request]');
    await step.locator('[data-party=employerName]').fill('Casa Pérez');
    await step.locator('[data-party=employerName]').blur();
    await expect(step.locator('.claim-text')).toContainText('A: Casa Pérez');
    await step.locator('[data-party=workerName]').fill('Ana Gil');
    await step.locator('[data-party=workerName]').blur();
    await step.locator('[data-pay-by]').fill('2026-12-01');
    await expect(step.locator('.claim-text')).toContainText('Fecha: 12 nov 2026');
    await expect(step.locator('.claim-text')).toContainText('Se pide que se pague antes del 1 dic 2026.');
    await expect(step.locator('.claim-text')).toContainText('brutos');
    await expect(step.locator('.claim-text')).not.toContainText(/interrump|suspend|art\./);
    await expect(step).toContainText('prueba del envío');
    // The names are saved in the offer
    expect(await page.evaluate(() => app.active().mine.parties)).toEqual({
      employerName: 'Casa Pérez',
      workerName: 'Ana Gil',
    });
  });

  test('«Hecho» is one tap, dated today, saved, and taken back with «Quitar»', async ({ page }) => {
    const step = page.locator('details.step[data-step=talk]');
    await step.locator(':scope > summary').click();
    await step.getByRole('button', { name: 'Hecho' }).click(); // the fold stays open: the date and the promise are there
    await expect(step.locator('.donemark')).toContainText('Hecho el 12 nov 2026');
    expect(await page.evaluate(() => app.active().mine.claim.steps)).toEqual({ talk: { done: '2026-11-12' } });
    await page.evaluate(() => app.select(app.active().id)); // repainted from the saved offer
    await expect(step.locator('.donemark')).toBeVisible();
    await step.getByRole('button', { name: 'Quitar' }).click();
    await expect(step.getByRole('button', { name: 'Hecho' })).toBeVisible();
    expect(await page.evaluate(() => app.active().mine.claim.steps)).toEqual({});
  });

  test('the legal path holds each formal step, the papeleta’s fields copy, and the court waits for the conciliation', async ({
    page,
  }) => {
    await openLegalPage(page);
    const legal = page.locator('#legalPage');
    for (const title of [
      'Sindicato',
      'Papeleta de conciliación',
      'Inspección de Trabajo',
      'Juzgado de lo Social',
      'FOGASA',
    ])
      await expect(legal.locator('details.step > summary', { hasText: title })).toBeVisible();
    await expect(legal).toContainText('CCOO, UGT y otros sindicatos');
    // only the caducity resumes after 15 días (LRJS 65.1), not the prescription of the amounts
    await expect(legal).toContainText('solo se reanuda la caducidad');
    await expect(legal).not.toContainText('el plazo sigue contando');
    await page.evaluate(() => {
      app.active().terms.province = 'L'; // no office known there
      app.select(app.active().id);
    });
    const papeleta = page.locator('details.step[data-step=conciliation]');
    await papeleta.locator(':scope > summary').click();
    await expect(papeleta).toContainText('servicio de mediación de la comunidad');
    await expect(papeleta).toContainText('LRJS, art. 65.1');
    const gross = amount(
      await papeleta.locator('.pfield', { hasText: 'Cantidad que se reclama' }).locator('.pv').textContent(),
    );
    expect(gross).toBeGreaterThan(amount(await tile(page, 'Falta').textContent()));
    await papeleta.getByRole('button', { name: /Copiar Cantidad que/ }).click();
    expect(amount(await page.evaluate(() => navigator.clipboard.readText()))).toBe(gross);
    // The court is not ready, and is once the conciliation is marked
    const court = page.locator('details.step[data-step=court]');
    await court.locator(':scope > summary').click();
    await expect(court).toContainText('Después de la conciliación');
    await papeleta.getByRole('button', { name: 'Hecho' }).click();
    await expect(court).toContainText('Si la conciliación acaba sin acuerdo');
    const inspection = page.locator('details.step[data-step=inspection]');
    await inspection.locator(':scope > summary').click();
    await expect(inspection.locator('.claim-text')).not.toContainText(/Falta|Queda por pagar/);
    await expect(legal).not.toContainText('interés');
  });

  test('the dismissal line leads to the papeleta: two sets of fields, the dismissal and the amounts', async ({
    page,
  }) => {
    await page.evaluate(async () => {
      const { offers } = await import('./src/offers.js');
      offers.setEnd(app.active(), { how: 'dismissed', date: '2026-11-06' });
      offers.setParties(app.active(), { employerName: 'Casa Pérez', employerId: 'B123', workerName: 'Ana Gil' });
      app.select(app.active().id);
    });
    await page.locator('.dismissal').getByRole('button', { name: 'Vía legal' }).click();
    const papeleta = page.locator('details.step[data-step=conciliation]');
    await expect(papeleta).toHaveAttribute('open', '');
    await expect(papeleta.locator('h4.pgroup')).toHaveText(['Las partes', 'Despido', 'Cantidades']);
    await expect(papeleta.locator('.pfield', { hasText: 'Fecha del despido' })).toContainText('6 nov 2026');
    const concept = await papeleta.locator('.pfield', { hasText: 'Concepto' }).locator('.pv').textContent();
    expect(concept).toMatch(/^Cantidades pendientes de pago\. [A-Z]/);
    expect(concept).not.toContain('Despedido');
  });

  test('in Aragón the papeleta names the provincial office', async ({ page }) => {
    await page.evaluate(() => {
      app.active().terms.province = 'HU';
      app.select(app.active().id);
    });
    await openLegalPage(page);
    const papeleta = page.locator('details.step[data-step=conciliation]');
    await papeleta.locator(':scope > summary').click();
    await expect(papeleta).toContainText('Ricardo del Arco');
    await expect(papeleta).toContainText('974 293 017');
    await expect(papeleta.locator('a[href*="aragon.es"]')).toBeVisible();
  });

  test('a dismissal puts its date on one short line with «Vía legal»; the rest is in the page, and acting on it is a «Hecho»', async ({
    page,
  }) => {
    await page.evaluate(async () => {
      const { offers } = await import('./src/offers.js');
      offers.setEnd(app.active(), { how: 'dismissed', date: '2026-11-06' }); // a Friday
      app.select(app.active().id);
    });
    const line = page.locator('.dismissal');
    await expect(line).toContainText('4 dic 2026 como muy tarde');
    await expect(line).toContainText('quedan 22 días');
    await expect(line).not.toContainText('Estatuto');
    await expect(line).not.toContainText('finiquito');
    expect(await page.evaluate(() => document.querySelector('.ask > .dismissal') !== null)).toBe(true);
    // Above the steps
    expect(
      await page.evaluate(
        () =>
          !!(
            document.querySelector('.dismissal')?.compareDocumentPosition(document.querySelector('details.step')) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ),
      ),
    ).toBe(true);
    await openLegalPage(page);
    const full = page.locator('#legalPage .dismissal');
    await expect(full).toContainText('Estatuto, art. 59.3');
    await expect(full).toContainText(
      'Presenta la papeleta de conciliación por despido antes de esa fecha; un sindicato puede ayudar',
    );
    await expect(full).toContainText('contando los festivos como días hábiles');
    await expect(full).toContainText('«recibí» o «no conforme», nunca como «recibí y conforme»');
    await full.getByRole('button', { name: 'Papeleta presentada' }).click();
    await expect(full.locator('.donemark')).toContainText('Papeleta presentada el 12 nov 2026');
  });

  test('the block is short: the message, one line with the deadline and «Vía legal»; Back from the page returns to Cuentas', async ({
    page,
  }) => {
    const block = page.locator('#result .ask');
    await expect(block.locator('details.step')).toHaveCount(1); // only «Hablar con el ganadero»
    await expect(block.locator('.due-line')).toContainText(
      /Plazo para reclamar: hasta el \d+ \w+ 2027 \(quedan \d+ días\)/,
    );
    await expect(block.getByRole('button', { name: 'Vía legal' })).toHaveCount(1);
    for (const gone of ['Petición de pago', 'Sindicato', 'Ver el expediente', 'no asesoramiento'])
      await expect(block).not.toContainText(gone);
    await expect(page.locator('#legalPage')).toBeHidden();
    await openLegalPage(page);
    await expect(page.locator('#legalPage h1')).toHaveText('Vía legal');
    await expect(page.locator('#legalPage')).toContainText('Plazos');
    await expect(page.locator('#legalPage')).toContainText('Estatuto, art. 59.2');
    await expect(page.locator('#legalPage')).toContainText('Información general');
    await page.goBack();
    await expect(page.locator('#legalPage')).toBeHidden();
    await expect(page.locator('#result h2.mode')).toContainText('Cuentas');
    await openLegalPage(page);
    await page.getByRole('button', { name: 'Volver' }).click();
    await expect(page.locator('#legalPage')).toBeHidden();
  });

  test('money agreed en negro: said once in the page, as salary that can be claimed, in gross, with general information', async ({
    page,
  }) => {
    await openLegalPage(page);
    const note = page.locator('#legalPage .block', { hasText: 'Dinero pactado en negro' });
    await expect(note).toContainText('también es salario');
    await expect(note).toContainText('mensajes, testigos, pagos anteriores');
    await expect(note).toContainText('brutas');
    await expect(note).toContainText('sindicato');
  });
});

test.describe('without cobros, and when nothing is owed', () => {
  test.use({ today: '2026-11-12' });

  test('«No se cobró nada» makes Falta work, is not a payment, and is taken back', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await openAccounts(page);
    await expect(tile(page, 'Falta')).toHaveText('—');
    await page.locator('.result').getByRole('button', { name: 'No se cobró nada' }).click();
    // It asks first: nothing is said until it is confirmed
    expect(await page.evaluate(() => app.active().mine.record.paid)).toBeUndefined();
    await page.getByRole('button', { name: 'Volver' }).click();
    await expect(tile(page, 'Falta')).toHaveText('—');
    await page.locator('.result').getByRole('button', { name: 'No se cobró nada' }).click();
    await page.getByRole('button', { name: 'Sí, nada' }).click();
    const corresponde = amount(await tile(page, 'Corresponde').textContent());
    expect(amount(await tile(page, 'Falta').textContent())).toBe(corresponde);
    expect(await page.evaluate(() => app.active().mine.record.payments)).toEqual([]);
    expect(await page.evaluate(() => app.active().mine.record.paid)).toBe('none');
    await expect(page.locator('details.step[data-step=talk] .claim-text')).toContainText('Cobrado: nada hasta ahora.');
    await expect(page.locator('.ask .due-line')).toContainText('Plazo para reclamar');
    await openRegistro(page);
    await expect(page.locator('.cobros')).toContainText('Se apuntó que no se cobró nada');
    await page.locator('.cobros').getByRole('button', { name: 'Quitar' }).click();
    await closeRegistro(page);
    // Taken back: the job is as it was, finished with nothing recorded, and the question returns
    await expect(page.getByRole('group', { name: '¿Se cobró este trabajo?' })).toBeVisible();
  });

  test('a dismissal with nothing owed still shows its line, and no steps', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 50000, via: 'payroll' }]);
    await expect(page.locator('#result h2.mode small')).toHaveText('Cuentas saldadas');
    await page.evaluate(async () => {
      const { offers } = await import('./src/offers.js');
      offers.setEnd(app.active(), { how: 'dismissed', date: '2026-11-06' });
      app.select(app.active().id);
    });
    await expect(page.locator('.dismissal')).toBeVisible();
    // The union and the papeleta, and nothing else of the ladder, in the page
    await expect(page.locator('.ask details.step')).toHaveCount(0);
    await openLegalPage(page);
    await expect(page.locator('#legalPage details.step')).toHaveCount(2);
    await expect(page.locator('#legalPage details.step[data-step=union]')).toHaveCount(1);
    await expect(page.locator('#legalPage details.step[data-step=conciliation]')).toHaveCount(1);
  });
});

test.describe('at 375 px', () => {
  test.use({ today: '2026-11-12' });
  for (const scheme of ['light', 'dark']) {
    test(`the block fits the width (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 800 });
      await page.emulateMedia({ colorScheme: scheme });
      await loadOffers(page, sample, PUERTO_A_OTRA);
      await addPayments(page, PAID);
      await page.evaluate(async () => {
        const { offers } = await import('./src/offers.js');
        offers.setEnd(app.active(), { how: 'dismissed', date: '2026-11-06' });
        app.select(app.active().id);
      });
      const wideIn = (selector) =>
        page.evaluate(
          (selector) =>
            [...document.querySelectorAll(`${selector} *`)].filter((e) => e.getBoundingClientRect().right > 376).length,
          selector,
        );
      expect(await wideIn('.ask')).toBe(0);
      expect(await page.evaluate(ledgerProblems, '.ask')).toEqual([]);
      await openLegalPage(page);
      for (const step of await page.locator('#legalPage details.step > summary').all()) await step.click();
      expect(await wideIn('#legalPage')).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
      await page.screenshot({ path: `test-results/claim-${scheme}.png`, fullPage: false });
    });
  }
});

test.describe('the status of a card in Trabajos', () => {
  test.use({ today: '2026-11-12' });
  const NAME = 'Puerto A, otra cuenta';
  const card = (page) => page.locator('#cards .ocard', { hasText: NAME }).first();
  const list = (page) => page.evaluate(() => app.showTab('offers'));

  test('there is no «Para reclamar» group: the card stays in its year, marked red where the ganadero owes', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, PAID);
    await list(page);
    expect(await page.locator('#cards .year-head b').allTextContents()).not.toContain('Para reclamar');
    await expect(card(page)).toHaveClass(/st-red/);
    await expect(card(page).locator('.oc-status')).toContainText(/Debe el ganadero [\d.]+\s€/);
    // The long «Siguiente: … · plazo legal» line is gone: the deadline lives in the ficha
    await expect(card(page)).not.toContainText('Siguiente');
    await expect(card(page)).not.toContainText('plazo legal');
    expect(await page.locator('#cards .ocwrap', { hasText: NAME }).count()).toBe(1);
    const year = await page.evaluate((name) => {
      const el = [...document.querySelectorAll('#cards > .year-head, #cards .ocard')];
      const at = el.findIndex((x) => x.textContent.includes(name));
      return el
        .slice(0, at)
        .reverse()
        .find((x) => x.matches('.year-head'))?.textContent;
    }, NAME);
    expect(year).toMatch(/^2026/);
  });

  test('grey with nothing recorded; amber while a deadline runs and nothing is recorded; calm once paid in full; «Todo cobrado» when closed', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await list(page);
    await expect(card(page)).toHaveClass(/st-grey/);
    await expect(card(page).locator('.oc-status')).toHaveText('Sin registro');
    await page.evaluate(async () => {
      const { offers } = await import('./src/offers.js');
      offers.closeMonth(app.active(), { key: '2026-06', from: '2026-06-21', to: '2026-06-30' });
    });
    await list(page);
    await expect(card(page)).toHaveClass(/st-amber/);
    await expect(card(page).locator('.oc-status')).toContainText('Sin cobros apuntados');
    await page.evaluate(async () => {
      const { offers } = await import('./src/offers.js');
      offers.addPayment(app.active(), { date: '2026-07-05', amount: 50000, via: 'payroll' });
    });
    await list(page);
    // Paid in full: nothing to claim, so no deadline runs and the card stays calm
    await expect(card(page).locator('.oc-status')).toHaveCount(0);
    await page.evaluate(async () => {
      const { offers } = await import('./src/offers.js');
      const { settleOffer } = await import('./src/state.js');
      for (const row of settleOffer(app.active()).rows)
        offers.closeMonth(app.active(), { key: row.month, from: row.calendarFrom, to: row.calendarTo });
    });
    await list(page);
    await expect(card(page).locator('.oc-status')).toHaveCount(0);
    await page.evaluate(async () => {
      const { offers } = await import('./src/offers.js');
      offers.completeRecord(app.active());
    });
    await list(page);
    await expect(card(page)).not.toHaveClass(/st-(red|amber)/);
    await expect(card(page).locator('.oc-status')).toHaveText('Todo cobrado');
  });

  test('a job not worked has no status', async ({ page }) => {
    await loadOffers(page, sample, 0);
    await list(page);
    await expect(page.locator('#cards .ocard.offer-only .oc-status')).toHaveCount(0);
  });
});

test('Leyes: «Dónde reclamar» is the ladder in brief, with sources; the welcome names the three moments', async ({
  page,
}) => {
  await page.evaluate(() => app.openLawsPage?.());
  await page.locator('[data-action=openLawsPage]').first().click();
  const fold = page.locator('#law-claim');
  await fold.locator(':scope > summary').click();
  for (const step of [
    'Hablar con el ganadero',
    'Un sindicato',
    'Papeleta de conciliación',
    'Inspección de Trabajo',
    'Juzgado de lo Social',
    'FOGASA',
  ])
    await expect(fold).toContainText(step);
  await expect(fold.locator('a[href*="BOE-A-2011-15936"]').first()).toBeVisible();
  await expect(fold.locator('a[href*="aragon.es"]')).toBeVisible();
  await expect(fold).toContainText('20 días hábiles');
});

test('the welcome names negotiating, keeping a record and settling accounts', async ({ page }) => {
  await expect(page.locator('#welcome')).toContainText('Negociar');
  await expect(page.locator('#welcome')).toContainText('Llevar el registro');
  await expect(page.locator('#welcome li', { hasText: 'Cuentas:' })).toContainText('lo que falta por pagar');
  await expect(page.locator('#welcome')).not.toContainText('Saldar las cuentas');
});

test.describe('the hints at the end of a job', () => {
  test.use({ today: '2026-11-12' });
  test('finiquito and vida laboral are in «Vía legal», with no «certificado de empresa»; the backup nudge for a guest stays', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, PAID);
    await expect(page.locator('details[data-fold=closing]')).toHaveCount(0); // it is in the page of its own
    await expect(page.locator('.block.ask')).toContainText('solo están en este navegador');
    await openLegalPage(page);
    const page_ = page.locator('#legalPage');
    await expect(page_).toContainText('«recibí» o «no conforme», nunca como «recibí y conforme»');
    await expect(page_).toContainText('Estatuto, art. 49.2');
    await expect(page_.locator('a[href*="seg-social"]')).toBeVisible();
    await expect(page_).not.toContainText('certificado de empresa');
  });
});

test.describe('talking to the ganadero while the job goes on, and done steps', () => {
  test.use({ today: '2026-08-12' });

  test('under way with months unpaid: the summary up to today, in a closed fold under «Hasta hoy»', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page
      .getByRole('group', { name: '¿Empezó el trabajo?' })
      .getByRole('button', { name: 'Sí', exact: true })
      .click();
    // With no cobro said there is nothing to talk about yet
    await expect(page.locator('details.step[data-step=talk]')).toHaveCount(0);
    await addPayments(page, [{ date: '2026-07-05', amount: 400, via: 'payroll' }]);
    const fold = page.locator('details.step[data-step=talk]');
    await expect(fold).not.toHaveAttribute('open', '');
    await fold.locator(':scope > summary').click();
    const text = fold.locator('.claim-text');
    await expect(text).toContainText('Corresponde hasta el 12 ago 2026');
    await expect(text).toContainText('¿Cuándo se puede pagar?');
    const falta = amount(await tile(page, 'Falta').textContent());
    expect(amount((await text.textContent()).match(/Falta: ([\d.,]+)\s€ netos/)[1])).toBe(falta);
    // Under «Hasta hoy», before the calendar
    expect(
      await page.evaluate(
        () =>
          !!(
            document.querySelector('.sofar')?.compareDocumentPosition(document.querySelector('details.step')) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ) && !document.querySelector('#legalPage:not([hidden])'),
      ),
    ).toBe(true);
  });

  test('a step marked «Hecho» says so in its summary and stays as the reader left it', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-12T12:00:00'));
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, PAID);
    const step = page.locator('details.step[data-step=talk]');
    await expect(step).not.toHaveAttribute('open', '');
    await step.locator(':scope > summary').click();
    await expect(step).toHaveAttribute('open', '');
    await step.getByRole('button', { name: 'Hecho' }).click();
    await expect(step.locator(':scope > summary')).toContainText('hecho');
    await expect(step.locator('.donemark')).toBeVisible();
  });

  test('with no cobros the step has no «Hecho»: there is nothing to have done yet', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-12T12:00:00'));
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await openAccounts(page);
    const step = page.locator('details.step[data-step=talk]');
    await expect(step).toBeVisible();
    await expect(step.getByRole('button', { name: 'Hecho' })).toHaveCount(0);
  });
});

test.describe('a promise to pay', () => {
  test.use({ today: '2026-11-12' });

  test('typed after the conversation, it is kept on the step; the card carries no long line', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, PAID);
    const step = page.locator('details.step[data-step=talk]');
    await step.locator(':scope > summary').click();
    await step.getByRole('button', { name: 'Hecho' }).click();
    await step.locator('[data-promise]').fill('2026-11-20');
    expect(await page.evaluate(() => app.active().mine.claim.steps.talk)).toEqual({
      done: '2026-11-12',
      promise: '2026-11-20',
    });
    await page.evaluate(() => app.showTab('offers'));
    // The card keeps its colour and no long line: the promise lives in the ficha
    const card = page.locator('#cards .ocwrap', { hasText: 'Puerto A, otra cuenta' }).first();
    await expect(card).toHaveClass(/./);
    await expect(card).not.toContainText('Prometió');
    await expect(card.locator('.oc-status')).toContainText('Debe el ganadero');
  });

  test('the Petición says that its months are not reviewed', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, PAID);
    await openLegalPage(page);
    await expect(page.locator('details.step[data-step=request] .claim-text')).toContainText(
      'Cálculo con 4 meses sin revisar',
    );
  });
});

test.describe('an old job: every month past its deadline', () => {
  test.use({ today: '2028-03-01' });

  test('the line says when it passed, the request is informal only, and the card says «Prescrito», in grey', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, PAID);
    await expect(page.locator('#result')).toContainText(/Plazo para reclamar: pasó el \d+ \w+ 2027/);
    await expect(page.locator('#result')).not.toContainText('Plazo para reclamar: hasta el');
    await expect(page.locator('#result .block.ask').getByRole('button', { name: 'Vía legal' })).toHaveCount(0);
    await expect(page.locator('details.step[data-step=talk]')).toBeVisible();
    await page.evaluate(() => app.showTab('offers'));
    const card = page.locator('#cards .ocard', { hasText: 'Puerto A, otra cuenta' });
    // Lapsed: grey and «Prescrito», never red
    await expect(card.locator('.oc-status')).toContainText('Prescrito');
    await expect(card.locator('.oc-status')).toHaveClass(/grey/);
    await expect(card).toHaveClass(/st-grey/);
    await expect(card).not.toHaveClass(/st-red/);
    await expect(card.locator('.oc-status')).not.toContainText('Debe el ganadero');
  });
});

test.describe('a job still within its deadline', () => {
  test.use({ today: '2026-11-12' });

  test('the card says until when it can be claimed', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, PAID);
    await page.evaluate(() => app.showTab('offers'));
    await expect(
      page.locator('#cards .ocard', { hasText: 'Puerto A, otra cuenta' }).locator('.oc-status'),
    ).toContainText(/hasta el \d+ \w+ 2027/);
  });
});
