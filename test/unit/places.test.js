// The place list: search, and the loader's choices (when to preload, the cache). Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { articleFirst, buildIndex, fold, MAX_SUGGESTIONS, placeOfTerms, searchPlaces } from '../../src/places.js';
import { createPlacesLoader, defersPreload, PLACES_VERSION } from '../../src/storage/places.js';

const real = JSON.parse(readFileSync(new URL(`../../data/places-${PLACES_VERSION}.json`, import.meta.url), 'utf8'));

/** A few places that exercise the three groups of the search. */
const small = {
  provinces: [
    ['HU', 'Huesca'],
    ['Z', 'Zaragoza'],
  ],
  municipalities: [
    ['Aínsa-Sobrarbe', 0, '22000'],
    ['Zaragoza', 1, '50297'],
  ],
  places: [
    ['Aínsa', 0],
    ['Mediano Aínsa', 0],
    ['Ribainsa', 0],
    ['Sobrarbe', 0],
    ['Zaragoza', 1],
    ['Zaragoza Sur', 1],
  ],
};

const names = (index, query) => searchPlaces(index, query).map((p) => p.name);

test('fold drops accents and case', () => {
  assert.equal(fold('  Aínsa-Sobrarbe '), 'ainsa-sobrarbe');
  assert.equal(fold('ÑÁÉÍÓÚÜ'), 'naeiouu');
});

test('the article goes back to the front of a name', () => {
  assert.equal(articleFirst("Ènova, l'"), "l'Ènova");
  assert.equal(articleFirst('Puerto de Santa María, El'), 'El Puerto de Santa María');
  assert.equal(articleFirst('Coruña, A'), 'A Coruña');
  assert.equal(articleFirst('Pinós, el/Pinoso'), 'El Pinós/Pinoso');
  assert.equal(articleFirst("Lorcha/Orxa, l'"), "Lorcha/l'Orxa");
  assert.equal(articleFirst('Yebra de Basa'), 'Yebra de Basa');
  assert.equal(articleFirst('Santa Caterina i La Ribera'), 'Santa Caterina i La Ribera');
});

test('the built list has no trailing articles', () => {
  const names = [...real.municipalities.map(([name]) => name), ...real.places.map(([name]) => name)];
  assert.deepEqual(
    names.filter((name) => articleFirst(name) !== name),
    [],
  );
});

test('search: starts with, then word start, then contains; accents and case do not matter', () => {
  const index = buildIndex(small);
  assert.deepEqual(names(index, 'AINSA'), ['Aínsa', 'Mediano Aínsa', 'Ribainsa']);
  assert.deepEqual(names(index, 'sur'), ['Zaragoza Sur']);
});

test('search: shorter names first within a group', () => {
  const index = buildIndex({
    ...small,
    places: [
      ['Zaragoza Sur', 1],
      ['Zaragoza', 1],
    ],
  });
  assert.deepEqual(names(index, 'zara'), ['Zaragoza', 'Zaragoza Sur']);
});

test('search: shorter names first in the contains group too', () => {
  const index = buildIndex({
    ...small,
    places: [
      ['Ribainsa Alta', 0],
      ['Ribainsa', 0],
    ],
  });
  assert.deepEqual(names(index, 'ains'), ['Ribainsa', 'Ribainsa Alta']);
});

test('search: a result names the village, its municipality and province', () => {
  assert.deepEqual(searchPlaces(buildIndex(small), 'mediano')[0], {
    name: 'Mediano Aínsa',
    municipality: 'Aínsa-Sobrarbe',
    municipalityCode: '22000',
    province: 'Huesca',
    provinceCode: 'HU',
  });
});

test('search: nothing under two letters, and at most eight results', () => {
  const index = buildIndex(real);
  assert.deepEqual(searchPlaces(index, 'a'), []);
  assert.deepEqual(searchPlaces(index, '  '), []);
  assert.equal(searchPlaces(index, 'san').length, MAX_SUGGESTIONS);
});

test('the real list finds Yebra de Basa with its INE code and province', () => {
  const index = buildIndex(real);
  assert.equal(real.provinces.length, 52);
  const [first] = searchPlaces(index, 'yebra de basa');
  assert.deepEqual(first, {
    name: 'Yebra de Basa',
    municipality: 'Yebra de Basa',
    municipalityCode: '22252',
    province: 'Huesca',
    provinceCode: 'HU',
  });
  assert.equal(searchPlaces(index, 'zaragoza')[0].province, 'Zaragoza');
});

test('terms resolve to names by municipality, or by province alone', () => {
  const index = buildIndex(real);
  assert.deepEqual(placeOfTerms(index, { municipality: '22252', province: 'HU' }), {
    municipality: 'Yebra de Basa',
    province: 'Huesca',
  });
  assert.deepEqual(placeOfTerms(index, { municipality: '', province: 'HU' }), { municipality: '', province: 'Huesca' });
  assert.equal(placeOfTerms(index, { municipality: '', province: '' }), null);
  assert.equal(placeOfTerms(index, { municipality: '99999', province: '' }), null);
});

/* --- The loader --- */

test('preload is held back by data saving and by 2G, not otherwise', () => {
  assert.equal(defersPreload(undefined), false); // no Network Information API (Firefox, Safari)
  assert.equal(defersPreload({}), false);
  assert.equal(defersPreload({ saveData: false, effectiveType: '4g' }), false);
  assert.equal(defersPreload({ effectiveType: '3g' }), false);
  assert.equal(defersPreload({ saveData: true, effectiveType: '4g' }), true);
  assert.equal(defersPreload({ effectiveType: '2g' }), true);
  assert.equal(defersPreload({ effectiveType: 'slow-2g' }), true);
});

/** Cache Storage in memory. */
function fakeCaches(names = []) {
  const stores = new Map(names.map((name) => [name, new Map()]));
  return {
    stores,
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        match: async (url) => store.get(url)?.clone(),
        put: async (url, response) => void store.set(url, response),
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name) => stores.delete(name),
  };
}

function environment({ caches, connection, ok = true } = {}) {
  const env = {
    requests: 0,
    caches,
    connection: () => connection,
    async fetch() {
      env.requests++;
      return ok ? new Response(JSON.stringify(small)) : new Response('', { status: 503 });
    },
  };
  return env;
}

test('one load at a time, then none: the index is kept', async () => {
  const env = environment();
  const places = createPlacesLoader(env);
  assert.equal(places.status(), 'idle');
  const [a, b] = [places.load(), places.load()];
  assert.equal(places.status(), 'loading');
  assert.equal(await a, await b);
  await places.load();
  assert.equal(env.requests, 1);
  assert.equal(places.status(), 'ready');
  assert.equal(places.loaded(), await a);
});

test('the file is downloaded once per version: a later visit reads Cache Storage', async () => {
  const caches = fakeCaches(['places-2020-01', 'unrelated']);
  const first = environment({ caches });
  await createPlacesLoader(first).load();
  assert.equal(first.requests, 1);
  assert.deepEqual([...caches.stores.keys()].sort(), [`places-${PLACES_VERSION}`, 'unrelated']); // the old version is gone

  const later = environment({ caches });
  const places = createPlacesLoader(later);
  await places.load();
  assert.equal(later.requests, 0);
  assert.equal(places.status(), 'ready');
});

test('without Cache Storage the file is fetched plainly', async () => {
  const env = environment({ caches: undefined });
  const places = createPlacesLoader(env);
  await places.load();
  assert.equal(env.requests, 1);
  assert.equal(places.loaded().municipalities.length, 2);
});

test('preload starts the load, unless data saving holds it back until the field asks', async () => {
  const saving = environment({ connection: { saveData: true } });
  const places = createPlacesLoader(saving);
  places.preload();
  assert.equal(places.status(), 'idle');
  assert.equal(saving.requests, 0);
  await places.load();
  assert.equal(saving.requests, 1);

  const normal = environment({ connection: { effectiveType: '4g' } });
  const other = createPlacesLoader(normal);
  other.preload();
  other.preload();
  assert.equal(other.status(), 'loading');
  await other.load();
  assert.equal(normal.requests, 1);
});

test('a failed load says so and the next call tries again', async () => {
  const env = environment({ ok: false });
  const places = createPlacesLoader(env);
  await assert.rejects(places.load(), /HTTP 503/);
  assert.equal(places.status(), 'error');
  env.fetch = async () => new Response(JSON.stringify(small));
  await places.load();
  assert.equal(places.status(), 'ready');
});

test('listeners hear every change of status', async () => {
  const places = createPlacesLoader(environment());
  const seen = [];
  places.onChange(() => seen.push(places.status()));
  await places.load();
  assert.deepEqual(seen, ['loading', 'ready']);
});
