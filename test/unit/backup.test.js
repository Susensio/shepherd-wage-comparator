// What loading a backup would do: which offers are added, whether its settings are taken, what is said. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DEF_CFG, makeOffer } from '../../src/offer.js';
import { planImport } from '../../src/storage/backup.js';

const offer = (id, name = id) => {
  const o = makeOffer();
  o.id = id;
  o.mine.name = name;
  return o;
};
const copy = (offers, cfg = { ...DEF_CFG, inKind: !DEF_CFG.inKind }) => JSON.stringify({ offers, cfg });
const config = { ...DEF_CFG };

describe('planImport', () => {
  test('text that is not a backup is a warning', () => {
    for (const content of ['hola', '{}', '{"offers":3}', 'null']) {
      const plan = planImport(content, { mine: [], config });
      assert.equal(plan.valid, false);
      assert.equal(plan.kind, 'warn');
      assert.match(plan.text, /^Eso no es una copia válida/);
    }
  });

  test('with no offers of your own: all are added and the settings are taken', () => {
    const plan = planImport(copy([offer('a'), offer('b')]), { mine: [], config });
    assert.deepEqual(
      plan.fresh.map((o) => o.id),
      ['a', 'b'],
    );
    assert.equal(plan.cfg.inKind, !DEF_CFG.inKind);
    assert.equal(plan.kind, 'ok');
    assert.equal(plan.text, 'Añadidas 2 ofertas.');
  });

  test('one offer is singular', () => {
    assert.equal(planImport(copy([offer('a')]), { mine: [], config }).text, 'Añadida 1 oferta.');
  });

  test('with offers of your own: only the new ones are added, your settings stay', () => {
    const plan = planImport(copy([offer('a'), offer('b'), offer('c')]), { mine: [offer('a'), offer('b')], config });
    assert.deepEqual(
      plan.fresh.map((o) => o.id),
      ['c'],
    );
    assert.equal(plan.cfg, null);
    assert.equal(plan.kind, 'ok');
    assert.equal(
      plan.text,
      'Añadida 1 oferta. Otras 2 ya estaban y no han cambiado. «Datos comunes» siguen como estaban.',
    );
  });

  test('an import that adds nothing does not replace your settings', () => {
    const plan = planImport(copy([offer('a')]), { mine: [offer('a')], config });
    assert.deepEqual(plan.fresh, []);
    assert.equal(plan.cfg, null);
    assert.equal(plan.kind, 'warn');
    assert.equal(
      plan.text,
      'No se ha añadido ninguna oferta: la de la copia ya estaba. «Datos comunes» siguen como estaban.',
    );
  });

  test('several already had are counted', () => {
    const mine = [offer('a'), offer('b')];
    const plan = planImport(copy([offer('a'), offer('b')], null), { mine, config });
    assert.equal(plan.text, 'No se ha añadido ninguna oferta: las 2 de la copia ya estaban.');
  });

  test('a copy without offers, for someone with none, still takes the settings and says so', () => {
    const plan = planImport(copy([]), { mine: [], config });
    assert.deepEqual(plan.fresh, []);
    assert.equal(plan.cfg.inKind, !DEF_CFG.inKind);
    assert.equal(plan.kind, 'warn');
    assert.equal(
      plan.text,
      'No se ha añadido ninguna oferta: la copia no tiene ofertas. Se han tomado los datos de la copia.',
    );
  });

  test('a copy without settings leaves them, and says nothing of them', () => {
    const plan = planImport(JSON.stringify({ offers: [offer('a')] }), { mine: [offer('b')], config });
    assert.equal(plan.cfg, null);
    assert.equal(plan.text, 'Añadida 1 oferta.');
  });

  test('the offers are completed with today’s defaults, and yours are not touched', () => {
    const mine = [offer('a', 'Mía')];
    const plan = planImport(JSON.stringify({ offers: [{ id: 'z', terms: {}, mine: {} }] }), { mine, config });
    assert.equal(plan.fresh[0].terms.durationUnit, makeOffer().terms.durationUnit);
    assert.equal(mine[0].mine.name, 'Mía');
  });
});
