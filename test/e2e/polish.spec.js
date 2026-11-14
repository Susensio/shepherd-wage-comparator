// «Para negociar» by strata, the chevron of «Condiciones», the hover of the offer cards and the folds of «¿Es legal?».

import { expect, loadOffers, sample, test } from './fixtures.js';

// Before every job: all the sample offers are only offers, with their full analysis
test.use({ today: '2025-01-01' });

const SIN_CONTRATO_D = 4;

test('«Para negociar»: the figure of what cash saves is the largest, then extra days and the minimum, overtime the smallest', async ({
  page,
}) => {
  await loadOffers(page, sample, 1);
  const sizes = await page.evaluate(() =>
    [...document.querySelectorAll('#secEmployer .lever')].map((lever) => ({
      id: lever.dataset.lever,
      stratum: Number(lever.dataset.stratum),
      size: Number.parseFloat(getComputedStyle(lever.querySelector('.save b')).fontSize),
    })),
  );
  expect(sizes.length).toBeGreaterThanOrEqual(2);
  const stratumSize = (n) => sizes.find((x) => x.stratum === n)?.size;
  const present = [1, 2, 3].filter((n) => stratumSize(n));
  expect(present.length).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < present.length - 1; i++)
    expect(stratumSize(present[i]), `stratum ${present[i]} above ${present[i + 1]}`).toBeGreaterThan(
      stratumSize(present[i + 1]),
    );
  // The order of the rows is kept: cash first, overtime last
  const order = sizes.map((x) => x.id);
  if (order.includes('cash')) expect(order[0]).toBe('cash');
  if (order.includes('overtime')) expect(order.at(-1)).toBe('overtime');
  const cash = sizes.find((x) => x.id === 'cash');
  if (cash) expect(cash.size).toBeGreaterThanOrEqual(30);
});

