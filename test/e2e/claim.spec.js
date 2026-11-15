// «Pedir lo que falta» (ADR-0034): asking the ganadero first, the legal path closed, a dismissal as one plain line.

import { expect, loadOffers, sample, test } from './fixtures.js';
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
    await page.locator('details.step[data-step=talk]').getByRole('button', { name: 'Compartir' }).click();
    expect(await page.evaluate(() => window.shared.length)).toBe(1);
    expect(await page.evaluate(() => window.shared[0])).toContain('¿Cuándo se puede pagar?');
  });

  test('«Petición de pago»: dated, in gross, with the pay-by date and the names typed there', async ({ page }) => {
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
    await step.getByRole('button', { name: 'Hecho' }).click();
    await step.locator(':scope > summary').click(); // a step done folds away
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
    await page.locator('details.legalpath > summary').click();
    const legal = page.locator('details.legalpath');
    for (const title of [
      'Sindicato',
      'Papeleta de conciliación',
      'Inspección de Trabajo',
      'Juzgado de lo Social',
      'FOGASA',
    ])
      await expect(legal.locator('details.step > summary', { hasText: title })).toBeVisible();
    await expect(legal).toContainText('CCOO, UGT y otros sindicatos');
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
    await page.locator('.dismissal').getByRole('button', { name: 'Ver la papeleta y la oficina' }).click();
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
    await page.locator('details.legalpath > summary').click();
    const papeleta = page.locator('details.step[data-step=conciliation]');
    await papeleta.locator(':scope > summary').click();
    await expect(papeleta).toContainText('Ricardo del Arco');
    await expect(papeleta).toContainText('974 293 017');
    await expect(papeleta.locator('a[href*="aragon.es"]')).toBeVisible();
  });

  test('a dismissal puts its date on one plain line above the steps, and acting on it is a «Hecho»', async ({
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
    await expect(line).toContainText('Estatuto, art. 59.3');
    expect(await page.evaluate(() => document.querySelector('.ask > .dismissal') !== null)).toBe(true);
    // Above the steps, not in the closed fold
    expect(
      await page.evaluate(
        () =>
          !!(
            document.querySelector('.dismissal')?.compareDocumentPosition(document.querySelector('details.step')) &
            Node.DOCUMENT_POSITION_FOLLOWING
          ),
      ),
    ).toBe(true);
    await expect(line).toContainText(
      'Presenta la papeleta de conciliación por despido antes de esa fecha; un sindicato puede ayudar',
    );
    await expect(line).toContainText('contando los festivos como días hábiles');
    await expect(line).toContainText('«recibí» o «no conforme», nunca como «recibí y conforme»');
    await line.getByRole('button', { name: 'Papeleta presentada' }).click();
    await expect(line.locator('.donemark')).toContainText('Papeleta presentada el 12 nov 2026');
  });
});

test.describe('without cobros, and when nothing is owed', () => {
  test.use({ today: '2026-11-12' });

  test('«No se cobró nada» makes Falta work, is not a payment, and is taken back', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await expect(tile(page, 'Falta')).toHaveText('—');
    await page.locator('.ask').getByRole('button', { name: 'No se cobró nada' }).click();
    const corresponde = amount(await tile(page, 'Corresponde').textContent());
    expect(amount(await tile(page, 'Falta').textContent())).toBe(corresponde);
    expect(await page.evaluate(() => app.active().mine.record.payments)).toEqual([]);
    expect(await page.evaluate(() => app.active().mine.record.nothingPaid)).toBe(true);
    await expect(page.locator('details.step[data-step=talk] .claim-text')).toContainText('Cobrado: nada hasta ahora.');
    await expect(page.locator('details.step[data-step=request]')).toBeVisible();
    await expect(page.locator('.cobros')).toContainText('Se apuntó que no se cobró nada');
    await page.locator('.cobros').getByRole('button', { name: 'Quitar' }).click();
    await expect(tile(page, 'Falta')).toHaveText('—');
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
    // The union and the papeleta, and nothing else of the ladder
    await expect(page.locator('.ask details.step')).toHaveCount(2);
    await expect(page.locator('.ask details.step[data-step=union]')).toHaveCount(1);
    await expect(page.locator('.ask details.step[data-step=conciliation]')).toHaveCount(1);
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
      await page.locator('details.legalpath > summary').click();
      for (const step of await page.locator('.legalpath details.step > summary').all()) await step.click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
      const wide = await page.evaluate(
        () => [...document.querySelectorAll('.ask *')].filter((e) => e.getBoundingClientRect().right > 376).length,
      );
      expect(wide).toBe(0);
      expect(await page.evaluate(ledgerProblems, '.ask')).toEqual([]);
      await page.screenshot({ path: `test-results/claim-${scheme}.png`, fullPage: false });
    });
  }
});

test.describe('«Para reclamar» in Ofertas', () => {
  test.use({ today: '2026-11-12' });
  const heads = (page) => page.locator('#cards .year-head b').allTextContents();
  const list = async (page) => {
    await page.evaluate(() => app.showTab('offers'));
  };

  test('a finished job with something owed inside its deadline comes first, with its next step and date', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, PAID);
    await list(page);
    expect((await heads(page))[0]).toBe('Para reclamar');
    const card = page.locator('#cards .ocwrap', { hasText: 'Puerto A, otra cuenta' }).first();
    await expect(card).toContainText(/Siguiente: hablar con el ganadero · plazo legal: \d+ \w+ 2027/);
    // It is not repeated under its year
    expect(await page.locator('#cards .ocwrap', { hasText: 'Puerto A, otra cuenta' }).count()).toBe(1);
    await page.evaluate(async () => {
      const { offers } = await import('./src/offers.js');
      for (const id of ['talk', 'request'])
        offers.markStep(
          app.state.offers.find((o) => o.mine.name === 'Puerto A, otra cuenta'),
          id,
          { done: '2026-11-12' },
        );
      app.select(app.active().id);
    });
    await expect(card).toContainText('Siguiente: sindicato');
  });

  /** The names of the cards under «Para reclamar». */
  const grouped = (page) =>
    page.evaluate(() => {
      const names = [];
      let on = false;
      for (const el of document.querySelectorAll('#cards > .year-head, #cards .ocard')) {
        if (el.classList.contains('year-head')) on = el.textContent.startsWith('Para reclamar');
        else if (on) names.push(el.querySelector('.oc-name').textContent);
      }
      return names;
    });
  const NAME = 'Puerto A, otra cuenta';

  test('nothing owed: not in the group; a dismissal window open: in it', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 50000, via: 'payroll' }]);
    await list(page);
    expect(await grouped(page)).not.toContain(NAME);
    await page.evaluate(async () => {
      const { offers } = await import('./src/offers.js');
      offers.setEnd(app.active(), { how: 'dismissed', date: '2026-11-06' });
      app.select(app.active().id);
    });
    await list(page);
    expect(await grouped(page)).toContain(NAME);
    await expect(page.locator('#cards .ocwrap', { hasText: NAME }).first()).toContainText(
      'Siguiente: presentar la papeleta por despido · plazo legal: 4 dic 2026',
    );
  });

  test('a finished job with no cobro said is in the group while a deadline runs, next step: write the cobros down', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await list(page);
    expect(await grouped(page)).toContain(NAME);
    const card = page.locator('#cards .ocwrap', { hasText: NAME }).first();
    await expect(card).toContainText(/Siguiente: apuntar los cobros · plazo legal: \d+ \w+ 2027/);
    await page.evaluate(() => {
      app.active().mine.record.nothingPaid = true;
      app.select(app.active().id);
    });
    await expect(card).toContainText('Siguiente: hablar con el ganadero');
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
  await expect(page.locator('#welcome')).toContainText('Saldar las cuentas');
});

test.describe('the hints at the end of a job', () => {
  test.use({ today: '2026-11-12' });
  test('finiquito, vida laboral and paro, and the backup nudge for a guest', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, PAID);
    const fold = page.locator('details[data-fold=closing]');
    await fold.locator(':scope > summary').click();
    await expect(fold).toContainText('«recibí» o «no conforme», nunca como «recibí y conforme»');
    await expect(fold).toContainText('Estatuto, art. 49.2');
    await expect(fold.locator('a[href*="seg-social"]')).toBeVisible();
    await expect(fold).toContainText('certificado de empresa');
    await expect(page.locator('.block.ask')).toContainText('solo están en este navegador');
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
          ) && !document.querySelector('.legalpath'),
      ),
    ).toBe(true);
  });

  test('a step marked «Hecho» folds away', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-12T12:00:00'));
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, PAID);
    const step = page.locator('details.step[data-step=talk]');
    await expect(step).toHaveAttribute('open', '');
    await step.getByRole('button', { name: 'Hecho' }).click();
    await expect(step).not.toHaveAttribute('open', '');
    await expect(step.locator(':scope > summary')).toContainText('hecho');
  });

  test('with no cobros the step has no «Hecho»: there is nothing to have done yet', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-12T12:00:00'));
    await loadOffers(page, sample, PUERTO_A_OTRA);
    const step = page.locator('details.step[data-step=talk]');
    await expect(step).toBeVisible();
    await expect(step.getByRole('button', { name: 'Hecho' })).toHaveCount(0);
  });
});

test.describe('a promise to pay', () => {
  test.use({ today: '2026-11-12' });

  test('typed after the conversation, the card says it; once the date passes the next step is the Petición', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, PAID);
    const step = page.locator('details.step[data-step=talk]');
    await step.getByRole('button', { name: 'Hecho' }).click();
    await step.locator(':scope > summary').click();
    await step.locator('[data-promise]').fill('2026-11-20');
    expect(await page.evaluate(() => app.active().mine.claim.steps.talk)).toEqual({
      done: '2026-11-12',
      promise: '2026-11-20',
    });
    await page.evaluate(() => app.showTab('offers'));
    const card = page.locator('#cards .ocwrap', { hasText: 'Puerto A, otra cuenta' }).first();
    await expect(card).toContainText(/Prometió pagar el 20 nov 2026 · plazo legal: \d+ \w+ 2027/);
    await page.clock.setFixedTime(new Date('2026-11-21T12:00:00'));
    await page.evaluate(() => app.select(app.active().id));
    await page.evaluate(() => app.showTab('offers'));
    await expect(card).toContainText('Siguiente: petición de pago');
  });

  test('the Petición says that its months are not reviewed', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, PAID);
    await expect(page.locator('details.step[data-step=request] .claim-text')).toContainText(
      'Cálculo con 4 meses sin revisar',
    );
  });
});
