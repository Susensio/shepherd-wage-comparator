// Fixes from the UI review of 14 November 2026: figures that contradicted each other, wording, tap targets, layout.

import { expect, loadOffers, sample, startOffer, test } from './fixtures.js';

const PUERTO_A_OTRA = 1; // 21 June to 30 September 2026, 17 h of overtime a week
const SIN_CONTRATO_D = 4; // 30 January to 12 March 2026
const at = (page, day) => page.clock.setFixedTime(new Date(`${day}T12:00:00`));
const addPayments = (page, list) =>
  page.evaluate(async (list) => {
    const { offers } = await import('./src/offers.js');
    for (const p of list) offers.addPayment(app.active(), p);
    app.select(app.active().id);
  }, list);
/** What the page copies, instead of the system clipboard. */
const captureCopies = (page) =>
  page.evaluate(() => {
    window.copied = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (text) => window.copied.push(text) },
    });
  });

test.describe('figures that must agree', () => {
  test.use({ today: '2026-11-12' });

  test('an item short under a pay above the minimum as a whole names the item, not a total sentence; without a contract, not even that', async ({
    page,
  }) => {
    await loadOffers(page, sample, SIN_CONTRATO_D);
    // Without a contract «no se pagan aparte» adds nothing to what the missing contract says: no line at all
    await expect(page.locator('#result')).not.toContainText('Las vacaciones no se pagan aparte');
    await expect(page.locator('#result')).not.toContainText('El mínimo exigible supera lo pactado');
  });

  test('«Copiar reclamación» on a job worked copies the Petición de pago; on one still to decide, the offer’s', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await captureCopies(page);
    await page.locator('#fichaMenu').click();
    await page.locator('#offerMenu [data-menu=copyClaim]').click();
    await expect.poll(() => page.evaluate(() => window.copied.length)).toBe(1);
    const worked = await page.evaluate(() => window.copied[0]);
    expect(worked).toContain('Asunto: petición de pago');
    expect(worked).not.toContain('SALARIO');
    await expect(page.locator('#offerMenu')).toBeHidden(); // it closes by itself after copying
    await page.clock.setFixedTime(new Date('2026-05-01T12:00:00'));
    await page.evaluate(() => app.select(app.active().id));
    await page.locator('#fichaMenu').click();
    await page.locator('#offerMenu [data-menu=copyClaim]').click();
    await expect.poll(() => page.evaluate(() => window.copied.length)).toBe(2);
    expect(await page.evaluate(() => window.copied[1])).toContain('SALARIO');
  });

  test('the year headers and «Año a año» keep what was cobrado apart from what the offers say', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.evaluate(() => app.showTab('offers'));
    const header = page.locator('#cards .year-head', { hasText: '2026' });
    await expect(header).toContainText('según las ofertas');
    await expect(header).not.toContainText('cobrados');
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    await page.evaluate(() => app.showTab('offers'));
    await expect(header).toContainText('1.000 € cobrados');
    await expect(header).toContainText('según las ofertas');
    await page.click('.tabs [data-tab=compare]');
    const yearly = page.locator('.yearly');
    await expect(yearly.locator('th', { hasText: /^Según las ofertas$/ })).toBeVisible();
    await expect(yearly.locator('tr', { has: page.locator('th', { hasText: /^Cobrado$/ }) })).toContainText('1.000 €');
  });
});

test.describe('overtime says one quantity', () => {
  test.use({ today: '2026-05-01' });

  test('the card of «¿Es legal?», the claim and the lever show the same hours a week', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    const week = await page.evaluate(async () => {
      const { fN } = await import('./src/format.js');
      return fN(app.calcOffer(app.active()).extra.overtimePerWeek);
    });
    const card = page.locator('[data-fold=law-hours] > summary');
    await expect(card).toContainText('Horas extra');
    await expect(card).toContainText(new RegExp(`${week}\\s*h\\s*/sem`));
    const claim = await page.evaluate(() => app.claimText(app.active(), app.calcOffer(app.active())));
    expect(claim).toContain(`unas ${week} a la semana`);
    const lever = await page.evaluate(async () => {
      const { leversOf } = await import('./src/text.js');
      return leversOf(app.calcOffer(app.active())).find((x) => x.id === 'overtime').proposal;
    });
    expect(lever).toContain(`Salen unas ${week} horas extra a la semana`);
  });
});

const PUERTO_A = 0; // solo oferta
const noOverlap = (a, b) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
const box = (loc) =>
  loc.evaluate((e) => {
    const b = e.getBoundingClientRect();
    return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width, height: b.height };
  });
const count = (text, part) => text.split(part).length - 1;

test.describe('Cuentas and Registro', () => {
  test.use({ today: '2026-11-12' });

  test('«Aún no hay cobros apuntados» is said once', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    expect(count(await page.locator('#result').innerText(), 'Aún no hay cobros apuntados')).toBe(1);
    // It is the main state of the yellow block, with the way out right there
    const prompt = page.locator('.result .nocobros');
    await expect(prompt).toBeVisible();
    await expect(prompt.getByRole('button', { name: '+ Apuntar cobro' })).toBeVisible();
    await expect(prompt.getByRole('button', { name: 'No se cobró nada' })).toBeVisible();
    await expect(page.locator('[data-action=openPaySheet]')).toHaveCount(1);
  });

  test('«¿Se cumplió la ley?» shows the facts of the terms at once and judges neither the minimum nor «estimado»', async ({
    page,
  }) => {
    await loadOffers(page, sample, SIN_CONTRATO_D);
    const block = page.locator('#result .block', { hasText: '¿Se cumplió la ley?' });
    await expect(block.locator('.lawcheck > div', { hasText: 'Sin contrato' }).locator('.m')).toHaveText('✘');
    // Nothing that cannot be judged: no row for the minimum or the bonus, one line saying when they will be
    await expect(block).not.toContainText('Se comprobará cuando');
    await expect(block.locator('.lawcheck > div', { hasText: 'Salario mínimo en nómina' })).toHaveCount(0);
    await addPayments(page, [{ date: '2026-03-01', amount: 100, via: 'payroll' }]);
    await expect(block).not.toContainText('estimado');
    await expect(page.locator('#result')).not.toContainText('por debajo del mínimo legal');
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await expect(block.locator('.lawcheck > div', { hasText: 'Parte en negro' }).locator('.m')).toHaveText('✘');
  });

  test('«Balance del trabajo» does not repeat the tiles; the days contributed say they include the vacation', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    const balance = page.locator('#result .block', { hasText: 'Balance del trabajo' });
    await expect(balance).not.toContainText('Corresponde en total');
    await expect(balance.locator('.rows > .row', { hasText: /^Cobrado/ })).toHaveCount(0);
    await expect(balance).toContainText(/incluye \d+ días? de vacaciones pagadas/);
  });

  test('tiles and headlines in whole euros', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 1000, via: 'payroll' }]);
    for (const text of await page.locator('.sofar b, .result .big').allTextContents()) expect(text).not.toContain(',');
  });

  test('the registro fold counts the months closed', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await expect(page.locator('[data-autofold=registro] > summary .stat')).toHaveText('4 sin cerrar · 0 cobros');
    await page.evaluate(async () => {
      const { offers } = await import('./src/offers.js');
      const { monthSpan } = await import('./src/model/accounts.js');
      for (const m of ['2026-06', '2026-07', '2026-08', '2026-09']) offers.closeMonth(app.active(), monthSpan(m));
      app.select(app.active().id);
    });
    await expect(page.locator('[data-autofold=registro] > summary .stat')).toHaveText('4 meses cerrados · 0 cobros');
  });

  test('«Revisar los meses» has one way back, and the days outside the job say «fuera»', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.locator('[data-action=reviewStart]').first().click();
    const backs = await page
      .locator('.back, .appbar-review button')
      .evaluateAll((els) => els.filter((e) => e.getClientRects().length).map((e) => e.textContent.trim()));
    expect(backs).toEqual(['‹ Cuentas']);
    await expect(page.locator('.cal .day.out small').first()).toHaveText('fuera');
  });

  test('the fold summaries share one style, and «Cobros» inside the registro is a small heading', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    const styles = await page.evaluate(() =>
      ['reference', 'registro'].map((name) => {
        const s = document.querySelector(`[data-fold=${name}] > summary, [data-autofold=${name}] > summary`);
        return getComputedStyle(s).textTransform;
      }),
    );
    expect(styles).toEqual(['uppercase', 'uppercase']);
    await page.locator('[data-fold=reference] > summary').click();
    await expect(page.locator('[data-fold=workings] > summary')).toHaveCSS('text-transform', 'uppercase');
    await expect(page.locator('[data-autofold=registro] h2')).toHaveCount(0);
    await expect(page.locator('[data-autofold=registro] h3', { hasText: 'Cobros' })).toBeVisible();
  });
});

test.describe('under way', () => {
  test.use({ today: '2026-08-12' });

  test('the month in progress: today ringed, the days to come faded, the counts up to today', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await expect(page.locator('.cal .day.today')).toHaveCount(1);
    await expect(page.locator('.cal .day.today')).toContainText('12');
    await expect(page.locator('.cal .day.ahead')).toHaveCount(19);
    await expect(page.locator('.cal .counts')).toContainText('hasta hoy');
    const counts = await page.locator('.cal .counts').innerText();
    const [jornadas, libranzas] = [/(\d+) jornadas?/, /(\d+) libranzas?/].map((re) => Number(counts.match(re)[1]));
    expect(jornadas + libranzas).toBe(12);
  });

  test('a card says «Falta», not «Debe el ganadero», while the job goes on; the pill sits on the detail line', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await addPayments(page, [{ date: '2026-07-05', amount: 400, via: 'payroll' }]);
    await page.evaluate(() => app.showTab('offers'));
    const card = page.locator('#cards .ocard', { hasText: 'Puerto A, otra cuenta' });
    await expect(card.locator('.oc-rec')).toContainText(/Falta [\d.]+\s€/);
    await expect(card.locator('.oc-rec')).not.toContainText('Debe el ganadero');
    for (const phase of await page.locator('#cards .phase').all())
      expect(await phase.evaluate((e) => e.parentElement.className)).toBe('oc-detail');
  });

  test('several months to close are all named in the nudge', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await at(page, '2026-09-12');
    await page.evaluate(() => app.select(app.active().id));
    await expect(page.locator('.nudge span')).toHaveText(/Junio, julio y agosto, por cerrar\./);
  });
});

test.describe('tap targets and layout', () => {
  test.use({ today: '2026-08-12' });

  test('what is tapped is at least 44 by 44: cobro removal, the nudge, summaries, copy icons, the app bar, Comparar', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await at(page, '2026-09-12');
    await page.evaluate(() => app.select(app.active().id));
    await addPayments(page, [{ date: '2026-07-05', amount: 400, via: 'payroll' }]);
    const small = (selector) =>
      page.locator(selector).evaluateAll((els) =>
        els
          .filter((e) => e.getClientRects().length)
          .map((e) => [
            e.className || e.tagName,
            Math.round(e.getBoundingClientRect().width),
            Math.round(e.getBoundingClientRect().height),
          ])
          .filter(([, w, h]) => w < 44 || h < 44),
      );
    expect(await small('.pr .rm, .nudge .linkbtn, .barbtn, #result details > summary')).toEqual([]);
    await page.click('.tabs [data-tab=compare]');
    expect(await small('.view .seg label, #cmpView .seg label')).toEqual([]);
  });

  test('the cobro sheet: «Guardar» and «Cancelar» are level', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.locator('[data-action=openPaySheet]').first().click();
    const save = await box(page.locator('#payForm .btns .pri'));
    const cancel = await box(page.locator('#payForm .btns [data-action=payCancel]'));
    expect([save.top, save.height]).toEqual([cancel.top, cancel.height]);
  });
});

test.describe('wide screen', () => {
  test.use({ viewport: { width: 1280, height: 800 }, today: '2026-11-12' });

  test('the account tooltip never covers the ficha header', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    const tip = page.locator('.tip-slot .tip');
    await expect(tip).toBeVisible();
    const tipBox = await box(tip);
    for (const target of ['#fichaMenu', '#fichaName', '#fichaPhase'])
      expect(noOverlap(tipBox, await box(page.locator(target))), target).toBe(true);
  });
});

test.describe('Comparar', () => {
  test.use({ today: '2026-11-14' });

  test('the names on the chart over time do not collide with each other or the axis', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.click('.tabs [data-tab=compare]');
    const names = await page.locator('.trend text.nm').evaluateAll((els) =>
      els.map((e) => {
        const b = e.getBoundingClientRect();
        return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
      }),
    );
    const axis = await page.locator('.trend text.axis').evaluateAll((els) =>
      els.map((e) => {
        const b = e.getBoundingClientRect();
        return { left: b.left, right: b.right, top: b.top, bottom: b.bottom };
      }),
    );
    expect(names.length).toBeGreaterThan(3);
    for (const [i, a] of names.entries()) {
      for (const b of names.slice(i + 1)) expect(noOverlap(a, b)).toBe(true);
      for (const b of axis) expect(noOverlap(a, b)).toBe(true);
    }
  });

  test('the legend says «En negro»', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await expect(page.locator('#result')).not.toContainText(/\bNegro\b/);
  });
});

test.describe('a new offer and Leyes', () => {
  test.use({ today: '2026-11-12' });

  test('an offer with no date has no phase pill, on the ficha or its card', async ({ page }) => {
    await loadOffers(page, sample, PUERTO_A);
    await page.evaluate(() => {
      app.active().terms.start = '';
      app.select(app.active().id);
    });
    await expect(page.locator('#fichaPhase')).toBeHidden();
    const id = await page.evaluate(() => app.active().id);
    await page.evaluate(() => app.showTab('offers'));
    await expect(page.locator(`#cards .ocard[data-id="${id}"] .phase`)).toHaveCount(0);
  });

  test('«Si no se sabe, marca…» shows only once the field is left empty', async ({ page }) => {
    await startOffer(page, 'offer', 'blank');
    await expect(page.locator('[data-required=duration]')).toBeHidden();
    await page.locator('#duration').focus();
    await expect(page.locator('[data-required=duration]')).toBeHidden();
    await page.locator('#hoursPerDay, #start').first().focus();
    await expect(page.locator('[data-required=duration]')).toContainText('Si no se sabe');
  });

  test('«Leyes y fuentes» is an index and four closed folds; «Dónde reclamar» opens from the ficha', async ({
    page,
  }) => {
    await loadOffers(page, sample, PUERTO_A_OTRA);
    await page.evaluate(() => app.openLawsPage());
    await expect(page.locator('.lawindex button')).toHaveCount(4);
    await expect(page.locator('.laws-pan details[open]')).toHaveCount(0);
    await page.locator('.lawindex [data-target=law-sources]').click();
    await expect(page.locator('#law-sources')).toHaveJSProperty('open', true);
    await page.evaluate(() => app.closePage?.());
    await page.evaluate(() => app.openFicha());
    await page.locator('#fichaName').scrollIntoViewIfNeeded();
  });
});
