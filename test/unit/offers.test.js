// The list of offers and its first-visit placeholder. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { DEF_CFG, makeOffer } from '../../src/offer.js';
import { createOffers } from '../../src/offers.js';
import { KEY } from '../../src/state.js';

const named = (name) => {
  const o = makeOffer();
  o.mine.name = name;
  return o;
};
const names = (state) => state.offers.map((o) => o.mine.name);

let state;
let memory;
let saves;
let list;

beforeEach(() => {
  state = { offers: [], activeId: '', placeholderId: null, firstRun: false, config: { ...DEF_CFG } };
  memory = new Map();
  saves = 0;
  list = createOffers({
    state,
    store: { get: (key, fallback) => memory.get(key) ?? fallback, set: (key, value) => memory.set(key, value) },
    notify: () => saves++,
  });
});

const startWith = (...offers) => {
  memory.set(KEY.offers, offers);
  list.start();
};

describe('start', () => {
  test('nothing saved is a first visit, with a placeholder', () => {
    list.start();
    assert.equal(state.firstRun, true);
    assert.equal(state.offers.length, 1);
    assert.equal(state.placeholderId, state.offers[0].id);
    assert.equal(state.activeId, state.offers[0].id);
    assert.deepEqual(list.mine(), []);
  });

  test('saved offers load with the saved active one', () => {
    const [a, b] = [named('A'), named('B')];
    memory.set(KEY.active, b.id);
    startWith(a, b);
    assert.equal(state.firstRun, false);
    assert.equal(state.placeholderId, null);
    assert.deepEqual(names(state), ['A', 'B']);
    assert.equal(state.activeId, b.id);
  });

  test('an active id that is gone falls back to the first offer', () => {
    const a = named('A');
    memory.set(KEY.active, 'gone');
    startWith(a);
    assert.equal(state.activeId, a.id);
  });

  test('a saved empty list is not a first visit, but still has an offer to show', () => {
    startWith();
    assert.equal(state.firstRun, false);
    assert.equal(state.offers.length, 1);
    assert.equal(state.placeholderId, null);
  });
});

describe('chooseTemplate', () => {
  test('replaces the placeholder, shows the template and saves', () => {
    list.start();
    const placeholder = state.placeholderId;
    const picked = named('Pastor');
    list.chooseTemplate(picked);
    assert.deepEqual(names(state), ['Pastor']);
    assert.ok(!state.offers.some((o) => o.id === placeholder));
    assert.equal(state.placeholderId, null);
    assert.equal(state.activeId, picked.id);
    assert.deepEqual(memory.get(KEY.offers), state.offers);
  });

  test('adds to your offers when there is no placeholder', () => {
    startWith(named('A'));
    list.chooseTemplate(named('B'));
    assert.deepEqual(names(state), ['A', 'B']);
  });
});

describe('add', () => {
  test('goes after the given offer, or at the end, and is shown', () => {
    startWith(named('A'), named('B'));
    list.add(named('A2'), { after: state.offers[0] });
    assert.deepEqual(names(state), ['A', 'A2', 'B']);
    assert.equal(state.activeId, state.offers[1].id);
    list.add(named('Z'));
    assert.deepEqual(names(state), ['A', 'A2', 'B', 'Z']);
    assert.equal(state.activeId, state.offers[3].id);
  });
});

describe('keepPlaceholder', () => {
  test('the placeholder becomes a real offer and is saved', () => {
    list.start();
    const { id } = state.offers[0];
    list.keepPlaceholder();
    assert.equal(state.placeholderId, null);
    assert.deepEqual(
      list.mine().map((o) => o.id),
      [id],
    );
    assert.ok(memory.has(KEY.offers));
  });
});

describe('remove', () => {
  beforeEach(() => startWith(named('A'), named('B'), named('C')));

  test('shows the previous offer, or the first', () => {
    assert.equal(list.remove(state.offers[1]), false);
    assert.deepEqual(names(state), ['A', 'C']);
    assert.equal(state.activeId, state.offers[0].id);
    list.remove(state.offers[0]);
    assert.deepEqual(names(state), ['C']);
    assert.equal(state.activeId, state.offers[0].id);
  });

  test('the last one goes back to a first visit: forgotten by storage, but seen by the listeners', () => {
    list.remove(state.offers[0]);
    list.remove(state.offers[0]);
    const before = saves;
    assert.equal(list.remove(state.offers[0]), true);
    assert.equal(saves, before + 1);
    assert.equal(state.offers.length, 1);
    assert.equal(state.placeholderId, state.offers[0].id);
    assert.equal(state.activeId, state.placeholderId);
    assert.deepEqual(list.mine(), []);
    assert.equal(memory.get(KEY.offers), null);
  });
});

describe('addImported', () => {
  test('drops the placeholder and says so', () => {
    list.start();
    const [a, b] = [named('A'), named('B')];
    assert.equal(list.addImported([a, b]), true);
    assert.deepEqual(names(state), ['A', 'B']);
    assert.equal(state.placeholderId, null);
    assert.equal(state.activeId, a.id);
  });

  test('keeps your offers and the active one', () => {
    startWith(named('A'), named('B'));
    const active = state.activeId;
    assert.equal(list.addImported([named('C')]), false);
    assert.deepEqual(names(state), ['A', 'B', 'C']);
    assert.equal(state.activeId, active);
  });
});

describe('the account', () => {
  test('its offers replace the list, keeping the active one if it is there', () => {
    startWith(named('A'), named('B'));
    const kept = state.offers[1];
    state.activeId = kept.id;
    list.replaceFromAccount([named('X'), kept]);
    assert.deepEqual(names(state), ['X', 'B']);
    assert.equal(state.activeId, kept.id);
    assert.equal(state.placeholderId, null);
    assert.equal(state.firstRun, false);
  });

  test('when the active offer is gone the first is shown', () => {
    startWith(named('A'));
    list.replaceFromAccount([named('X')]);
    assert.equal(state.activeId, state.offers[0].id);
  });

  test('an empty account is a first visit', () => {
    startWith(named('A'));
    list.replaceFromAccount([]);
    assert.equal(state.offers.length, 1);
    assert.equal(state.placeholderId, state.offers[0].id);
    assert.equal(state.activeId, state.placeholderId);
    assert.equal(state.firstRun, true);
    assert.deepEqual(list.mine(), []);
  });

  test('signing out is a first visit', () => {
    startWith(named('A'));
    list.clearForSignOut();
    assert.equal(state.offers.length, 1);
    assert.equal(state.placeholderId, state.activeId);
    assert.equal(state.firstRun, true);
    assert.deepEqual(list.mine(), []);
  });

  test('neither replacing nor signing out saves: the account does', () => {
    startWith(named('A'));
    list.replaceFromAccount([named('X')]);
    list.clearForSignOut();
    assert.equal(saves, 0);
    assert.equal(memory.get(KEY.offers)[0].mine.name, 'A');
  });

  test('a new id keeps the offer active', () => {
    startWith(named('A'), named('B'));
    const [a, b] = state.offers;
    state.activeId = a.id;
    list.remapId(a, 'new');
    assert.equal(a.id, 'new');
    assert.equal(state.activeId, 'new');
    list.remapId(b, 'other');
    assert.equal(state.activeId, 'new');
  });
});
