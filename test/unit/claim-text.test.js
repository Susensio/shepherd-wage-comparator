// The texts of the claim ladder: their amounts are the screens' (ADR-0034). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  claimToCopy,
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
import { marksOf, toggleDay } from '../../src/model/record.js';
import { settle } from '../../src/model/settle.js';
import { DEF_CFG } from '../../src/offer.js';
import { ingestSaved } from '../../src/schema.js';
import { offerOf } from './flat-offer.js';

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
    ...(amount ? {} : { paid: 'none' }),
  };
  const r = calc(o, ctx);
  const settled = settle(o, record, TODAY, calc(o, ctx));
  const standing = standingOf(settled, TODAY, 'finished', record.payments, r.netFactor, record.paid);
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

  test('says the jornadas and the libres of each month, above or below what was agreed, and which are estimated', () => {
    assert.match(text, /Jornadas por mes:\n· Junio: \d+ jornadas?, \d+ libres?.*\(estimado\)\n· Julio: /);
    // A month with a day more than the offer's says so
    const more = contextOf(worked[0], 300);
    const key = more.settled.rows[1].month;
    const span = { key, from: more.settled.rows[1].calendarFrom, to: more.settled.rows[1].calendarTo };
    const off = marksOf(more.o, more.record, span).find((m) => m.kind === 'off' && !m.outside);
    toggleDay(more.o, more.record, span, off.day);
    const changed = employerSummaryText({
      ...more,
      settled: settle(more.o, more.record, '2030-01-01', calc(more.o, ctx)),
    });
    assert.match(changed, /1 más de las pactadas/);
  });

  test('Falta is the amount alone, in total and per month: no breakdown by item', () => {
    assert.match(text, /\nFalta: [\d.]+\s€ netos\.\n· /);
    assert.doesNotMatch(text.slice(text.indexOf('Falta:')), /pernocta|vacaciones|salario/i);
    for (const line of text.split('\n').filter((l) => /^· \w+: [\d.]+\s€/.test(l))) assert.doesNotMatch(line, /\(/);
  });

  test('with nothing cobrado it says so', () => {
    assert.match(employerSummaryText(contextOf(worked[0], 0)), /Cobrado: nada hasta ahora\./);
  });

  test('«Lo pactado» says what was agreed was cobrado, not nothing', () => {
    const c = contextOf(worked[0], 0);
    const record = { months: {}, payments: [], paid: 'asAgreed' };
    const settled = settle(c.o, record, TODAY, calc(c.o, ctx));
    const standing = standingOf(settled, TODAY, 'finished', [], c.r.netFactor, 'asAgreed');
    const text = employerSummaryText({ ...c, record, settled, standing });
    assert.match(text, /Cobrado: lo pactado, [\d.]+\s€ netos\./);
    assert.doesNotMatch(text, /Cobrado: nada/);
  });
});

describe('«Petición de pago»', () => {
  const c = contextOf(worked[0], 300);
  const text = paymentRequestText(c);

  test('is dated, gross as the claim is, with the pay-by date, and polite', () => {
    assert.match(text, /^Fecha: 1 ene 2030/);
    assert.ok(text.includes(`Falta: ${fSumE(c.settled.totals.owed)} brutos`));
    assert.ok(text.includes('Se pide que se pague antes del 16 ene 2030.'));
    assert.match(text, /A: Casa Pérez \(B12345678\)/);
    assert.match(text, /Gracias\.\nAna Gil$/);
  });

  test('says each amount in one unit: what is owed in gross, what arrived in net, never both in one figure', () => {
    assert.doesNotMatch(text, /se comparan en bruto/);
    assert.match(text, /queda por pagar, en bruto:/);
  });

  test('says when months are not reviewed, and not when all are closed', () => {
    assert.match(text, /Cálculo con 4 meses sin revisar \(según lo pactado\): junio, julio, agosto y septiembre\./);
    const closed = contextOf(worked[0], 300);
    for (const row of closed.settled.rows) row.closed = true;
    assert.doesNotMatch(paymentRequestText(closed), /sin revisar/);
  });

  test('speaks in gross only: no net figure, and what arrived is said without a figure', () => {
    assert.doesNotMatch(text, /netos/);
    assert.match(text, /Lo ya cobrado está descontado\./);
    assert.doesNotMatch(paymentRequestText(contextOf(worked[0], 0)), /cobrado/);
    assert.match(text, /se pueden revisar\./);
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
    assert.doesNotMatch(text, /sin declarar|en mano, sin/);
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
        // Whole euros, as the tiles
        assert.equal(net.due, Math.round(c.standing.corresponde));
        assert.equal(net.owed, Math.round(c.standing.falta));
        assert.equal(sum(d.months.map((m) => m.net.due)), net.due, o.mine.name);
        assert.equal(sum(d.months.map((m) => m.net.owed)), net.owed, o.mine.name);
        for (const m of d.months)
          assert.equal(sum([m.net.due], [m.net.owed]), m.net.received, `${o.mine.name} ${m.month}`);
        assert.equal(sum(d.months.map((m) => m.gross.owed)), d.totals.gross.owed, o.mine.name);
        assert.equal(sum(d.items.map((x) => x.owed)), d.totals.gross.owed, o.mine.name);
        assert.equal(sum(d.lines.map((l) => l.due)), net.due, o.mine.name);
        for (const m of d.months) assert.equal(m.net.due - m.net.owed, m.net.received);
        assert.equal(sum(d.months.map((m) => m.net.received)), net.received, o.mine.name);
      }
  });
});

describe('the end said ends the job in every text', () => {
  const o = worked[0]; // 21 June to 30 September 2026
  const ended = (how) => {
    const c = contextOf(o, 300);
    c.record.end = { how, date: '2026-09-18' };
    c.settled = settle(o, c.record, TODAY, calc(o, ctx));
    c.standing = standingOf(c.settled, TODAY, 'finished', c.record.payments, c.r.netFactor);
    return c;
  };

  test('the dates are the job’s, and the amounts follow them', () => {
    const whole = contextOf(o, 300);
    const c = ended('dismissed');
    assert.ok(c.standing.corresponde < whole.standing.corresponde);
    for (const text of [employerSummaryText(c), paymentRequestText(c), inspectionText(c)]) {
      assert.ok(text.includes('18 sept 2026'), text);
      assert.ok(!text.includes('30 sept 2026'), text);
    }
    const period = conciliationFields(c).find((f) => f.id === 'period');
    assert.equal(period?.value, 'del 21 jun 2026 al 18 sept 2026');
    const september = c.settled.rows.at(-1);
    assert.equal(september.deadline, '2027-09-18');
  });

  test('the Expediente’s calendar shows the days after the end as outside the job, never libre', async () => {
    const { dossierOf } = await import('../../src/model/dossier.js');
    const c = ended('dismissed');
    const d = dossierOf({ o, netFactor: c.r.netFactor, settled: c.settled, standing: c.standing, record: c.record });
    const september = d.months.at(-1);
    assert.equal(september.month, '2026-09');
    assert.ok(september.marks.filter((m) => m.date > '2026-09-18').every((m) => m.outside));
    assert.equal(d.job.to, '2026-09-18');
  });
});

describe('the severance of a temporary contract is claimed with the rest (ET 49.1.c)', () => {
  const temporary = worked.find((o) => o.terms.contract === 'temporary' && calc(o, ctx).employer.severance > 1);
  test('it is in the message, the letter, the papeleta and the Expediente', () => {
    assert.ok(temporary, 'a sample temporary offer with a severance');
    const c = contextOf(temporary, 300);
    assert.ok(c.settled.totals.items.severance.owed > 0);
    const rows = owedNet(c.settled, Math.round(c.standing.falta), c.r.netFactor, 1);
    assert.ok(rows.some((m) => m.items.some((x) => x.item === 'severance')));
    assert.match(paymentRequestText(c), /indemnización/);
    const concept = conciliationFields(c).find((f) => f.id === 'concept');
    assert.match(concept?.value ?? '', /indemnización/);
    assert.ok(
      conciliationFields(c)
        .find((f) => f.id === 'amount')
        ?.value.includes(fSumE(c.settled.totals.owed)),
    );
  });
});

describe('under way, the message lists only the months counted so far', () => {
  test('months not yet due take no part of Falta', () => {
    const o = offerOf({
      id: 'u',
      name: 'U',
      start: '2026-09-01',
      contract: 'permanent',
      duration: 180,
      durationUnit: 'days',
      hoursPerDay: 8,
      daysOff: 2,
      daysOffUnit: 'week',
      holidays: 'no',
      payType: 'gross',
      payAmount: 1500,
      payUnit: 'month',
      extraPays: 'included',
      vacation: 'taken',
      housing: 'no',
      car: 'noCar',
      kmHome: 0,
      overnight: 'no',
      irpfMode: 'manual',
      irpfManual: 10,
    });
    const today = '2026-11-15';
    const record = { months: {}, payments: [], paid: 'none' };
    const r = calc(o, ctx);
    const settled = settle(o, record, today, calc(o, ctx));
    const standing = standingOf(settled, today, 'underway', [], r.netFactor, 'none');
    const text = employerSummaryText({ o, r, settled, standing, record, parties: PARTIES, until: today });
    assert.match(text, /Septiembre: /);
    assert.match(text, /Noviembre: /);
    assert.doesNotMatch(text, /Diciembre|Enero|Febrero/);
    const listed = [...text.matchAll(/^· \p{L}+: ([\d.]+)\s€$/gmu)].map((m) => Number(m[1].replace('.', '')));
    assert.equal(sum(listed), Math.round(standing.falta));
  });
});

describe('«Copiar reclamación»: one function decides what it copies, from the phase', () => {
  const base = { dismissed: false, offerClaim: 'oferta', summary: '', request: '', fields: [] };
  test('the offer, while it is not a job worked', () => {
    assert.equal(claimToCopy({ ...base, phase: 'offerOnly' }), 'oferta');
    assert.equal(claimToCopy({ ...base, phase: 'undecided' }), 'oferta');
    assert.equal(claimToCopy({ ...base, phase: 'undecided', offerClaim: '' }), null);
  });
  test('under way: the talk summary when something is owed, else hidden (never the offer’s claim)', () => {
    assert.equal(claimToCopy({ ...base, phase: 'underway', summary: 'resumen' }), 'resumen');
    assert.equal(claimToCopy({ ...base, phase: 'underway' }), null);
  });
  test('finished: the letter when owed; settled or with no cobros, hidden', () => {
    assert.equal(claimToCopy({ ...base, phase: 'finished', request: 'carta' }), 'carta');
    assert.equal(claimToCopy({ ...base, phase: 'finished' }), null);
  });
  test('a dismissal: the papeleta', () => {
    const fields = [
      { label: 'Fecha del despido', value: '5 jun 2026' },
      { label: 'Vacío', value: '' },
    ];
    assert.equal(
      claimToCopy({ ...base, phase: 'finished', dismissed: true, request: 'carta', fields }),
      'Fecha del despido: 5 jun 2026',
    );
  });
});

describe('the months of «Plazos» are in whole euros that add up to Falta, as the tiles show it', () => {
  test('every sample offer, with one cobro', () => {
    let checked = 0;
    for (const o of worked) {
      const c = contextOf(o, 333.33);
      if (!(c.standing.falta > 0) || !c.standing.deadlines.length) continue;
      const shown = c.standing.deadlines.map((d) => d.owedWhole);
      assert.ok(shown.every(Number.isInteger), o.mine.name);
      assert.equal(sum(shown), Math.round(c.standing.falta), o.mine.name);
      checked++;
    }
    assert.ok(checked > 0);
  });
});
