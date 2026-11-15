// The job as one thing with two sides (ADR-0035, phase C): the screens for what happened, whatever the terms say.

import { addJob, expect, test } from './fixtures.js';

test.describe('thin terms', () => {
  test.use({ today: '2026-11-15' });

  test('a job that began with no hours and no pay still shows its record, and asks nothing it cannot judge', async ({
    page,
  }) => {
    await addJob(page, { terms: { start: '2026-06-01', duration: 92, durationUnit: 'days' } });
    await expect(page.locator('#fichaPhase')).toHaveText('Acabada');
    await expect(page.locator('#result h2.mode')).toContainText('Cuentas');
    await expect(page.locator('#result')).not.toContainText('Falta lo que se paga');
    await expect(page.locator('#result')).not.toContainText('las horas por día');
  });

  test('an offer not yet started still asks for hours and pay', async ({ page }) => {
    await addJob(page, { terms: { start: '2026-12-01', duration: 3, durationUnit: 'months' } });
    await expect(page.locator('#result .empty')).toContainText('las horas por día');
  });
});

test.describe('the tab', () => {
  test.use({ today: '2026-05-01' });

  test('the first tab and the ficha’s way back are «Trabajos»; an offer not started waits under «Por decidir»', async ({
    loaded: page,
  }) => {
    await expect(page.locator('.tabs [data-tab=offers]')).toHaveText('Trabajos');
    await expect(page.locator('[data-action=closeFicha]')).toHaveText('Trabajos');
    await page.click('[data-action=closeFicha]');
    await expect(page.locator('#offersList')).toHaveAttribute('aria-label', 'Los trabajos');
    await expect(page.locator('#cards .year-head').first()).toContainText('Por decidir');
  });
});
