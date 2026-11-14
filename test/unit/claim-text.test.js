// The texts of the claim ladder: their amounts are the screens' (ADR-0034). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  conciliationFields,
  defaultPayBy,
  employerSummaryText,
  inspectionText,
  owedNet,
  paymentRequestText,
} from '../../src/claim-text.js';
import { fE } from '../../src/format.js';
import { fSumE, spreadTo, sum } from '../../src/ledger.js';
import { standingOf } from '../../src/model/accounts.js';
import { calc } from '../../src/model/calc.js';
import { settle } from '../../src/model/settle.js';
import { DEF_CFG } from '../../src/offer.js';
import { ingestSaved } from '../../src/schema.js';

const data = JSON.parse(readFileSync(new URL('../fixtures/offers.json', import.meta.url), 'utf8'));
const { offers, cfg } = ingestSaved(data, { fallbackCfg: DEF_CFG });
const ctx = { cfg, offers };
const TODAY = '2030-01-01';
const worked = offers.filter((o) => o.terms.start && !o.terms.offerOnly);
const PARTIES = { employerName: 'Casa Pérez', employerId: 'B12345678', workerName: 'Ana Gil' };

/** Everything a text takes, for an offer finished with one cobro (or none, said). */
function contextOf(o, amount) {
  const record = {
    months: {},
    payments: amount ? [{ id: 'a', date: '2026-07-01', amount, via: 'payroll' }] : [],
    ...(amount ? {} : { nothingPaid: true }),
  };
  const r = calc(o, ctx);
  const settled = settle(o, record, TODAY, ctx);
  const standing = standingOf(settled, TODAY, 'finished', record.payments, r.netFactor, record.nothingPaid);
  return {
    o,
    r,
    settled,
    standing,
    record,
    parties: PARTIES,
    today: TODAY,
    payBy: defaultPayBy(TODAY),
    netFactor: r.netFactor,
  };
}

describe('spreadTo', () => {
  test('rounds to cents and adds up to the total', () => {
    const rows = spreadTo([100.004, 200.004, 300.004], 600.02);
    assert.equal(sum(rows), 600.02);
    assert.deepEqual(spreadTo([], 5), []);
    assert.deepEqual(spreadTo([0, 0], 5), [0, 0]);
  });
});

describe('what is still owed, in net, equals Falta on the screen', () => {
  for (const amount of [0, 300]) {
    test(`every sample offer, with ${amount ? 'one cobro' : '«No se cobró nada»'}`, () => {
      for (const o of worked) {
        const c = contextOf(o, amount);
        if (!(c.standing.falta > 0)) continue;
        const months = owedNet(c.settled, c.standing.falta, c.r.netFactor);
        assert.equal(sum(months.map((m) => m.total)), c.standing.falta, o.mine.name);
        for (const m of months) assert.equal(sum(m.items.map((x) => x.amount)), m.total, `${o.mine.name} ${m.month}`);
        // The summary speaks in whole euros, as the tiles do, and its months add up to the Falta it says
        const whole = owedNet(c.settled, Math.round(c.standing.falta), c.r.netFactor, 1);
        assert.equal(sum(whole.map((m) => m.total)), Math.round(c.standing.falta), o.mine.name);
        for (const m of whole) assert.equal(sum(m.items.map((x) => x.amount)), m.total, `${o.mine.name} ${m.month}`);
        const text = employerSummaryText(c);
        assert.ok(text.includes(`Falta: ${fE(Math.round(c.standing.falta), 0)} netos.`), o.mine.name);
        assert.ok(text.includes(`Corresponde: ${fE(c.standing.corresponde, 0)} netos.`), o.mine.name);
      }
    });
  }
});

describe('«Resumen para el ganadero»', () => {
  const c = contextOf(worked[0], 300);
  const text = employerSummaryText(c);

  test('is conversational: no citations, ends asking when it can be paid, lists the cobros', () => {
    assert.ok(text.endsWith('¿Cuándo se puede pagar?'));
    assert.doesNotMatch(text, /art\.|Estatuto|ley|LRJS/i);
    assert.match(text, /Cobrado: 300\s€ netos\./);
    assert.match(text, /1 jul 2026: 300\s€ en nómina/);
    assert.match(text, /^Hola, Casa Pérez\./);
  });

  test('says the jornadas of each month and which are estimated', () => {
    assert.match(text, /Jornadas: junio \d+ \(estimadas\), julio/);
  });

  test('with nothing cobrado it says so', () => {
    assert.match(employerSummaryText(contextOf(worked[0], 0)), /Cobrado: nada hasta ahora\./);
  });
});

describe('«Petición de pago»', () => {
  const c = contextOf(worked[0], 300);
  const text = paymentRequestText(c);

  test('is dated, gross as the claim is, with the pay-by date, and polite', () => {
    assert.match(text, /^Fecha: 1 ene 2030/);
    assert.ok(text.includes(`Total pendiente: ${fSumE(c.settled.totals.owed)} brutos`));
    assert.ok(text.includes('Se pide que se pague antes del 16 ene 2030.'));
    assert.match(text, /A: Casa Pérez \(B12345678\)/);
    assert.match(text, /Gracias\.\nAna Gil$/);
  });

  test('says each amount in one unit: what is owed in gross, what arrived in net, never both in one figure', () => {
    assert.doesNotMatch(text, /se comparan en bruto/);
    assert.match(text, /queda por pagar, en bruto:/);
  });

  test('does not claim to stop any deadline nor cite law', () => {
    assert.doesNotMatch(text, /interrump|suspend|plazo|art\.|Estatuto/i);
  });

  test('its months add up to the total', () => {
    const rows = c.settled.rows.filter((row) => row.owed > 0);
    assert.equal(sum(rows.map((row) => row.owed)), c.settled.totals.owed);
  });
});

describe('«Hechos para la Inspección» and the papeleta’s fields', () => {
  const c = contextOf(worked[0], 300);

  test('the inspection text holds facts, no amount claimed', () => {
    const text = inspectionText({ ...c, record: { ...c.record, end: { how: 'dismissed', date: '2026-09-30' } } });
    assert.match(text, /Ganadero: Casa Pérez \(B12345678\)/);
    assert.match(text, /Cobros recibidos:/);
    assert.match(text, /despedido por el ganadero/);
    assert.doesNotMatch(text, /Queda por pagar|Falta|se reclama/);
  });

  test('without a contract it says so as a fact', () => {
    const none = worked.find((o) => o.terms.contract === 'none');
    assert.match(inspectionText(contextOf(none, 0)), /No hubo contrato ni alta/);
  });

  test('the fields come from the record, the amount being the settled gross owed', () => {
    const fields = conciliationFields(c);
    const by = Object.fromEntries(fields.map((f) => [f.id, f.value]));
    assert.equal(by.employer, 'Casa Pérez');
    assert.equal(by.employerId, 'B12345678');
    assert.equal(by.worker, 'Ana Gil');
    assert.equal(by.amount, fSumE(c.settled.totals.owed));
    assert.match(by.period, /^del 21 jun 2026 al 30 sept 2026$/);
    assert.match(by.concept, /^Cantidades pendientes de pago\./);
  });
});

describe('the Expediente’s figures add up to the tiles', () => {
  test('every sample offer, with a cobro or none: columns equal the totals, rows add up', async () => {
    const { dossierOf } = await import('../../src/model/dossier.js');
    for (const o of worked)
      for (const amount of [0, 300, 9999999]) {
        const c = contextOf(o, amount || 0);
        const d = dossierOf({
          o,
          netFactor: c.r.netFactor,
          settled: c.settled,
          standing: c.standing,
          record: c.record,
        });
        const net = d.totals.net;
        assert.equal(net.due, c.standing.corresponde);
        assert.equal(net.owed, c.standing.falta);
        assert.equal(sum(d.months.map((m) => m.net.due)), net.due, o.mine.name);
        assert.equal(sum(d.months.map((m) => m.net.owed)), net.owed, o.mine.name);
        for (const m of d.months)
          assert.equal(sum([m.net.due], [m.net.owed]), m.net.received, `${o.mine.name} ${m.month}`);
        assert.equal(sum(d.months.map((m) => m.gross.owed)), d.totals.gross.owed, o.mine.name);
        assert.equal(sum(d.items.map((x) => x.owed)), d.totals.gross.owed, o.mine.name);
        assert.equal(sum(d.lines.map((l) => l.due)), net.due, o.mine.name);
      }
  });
});
