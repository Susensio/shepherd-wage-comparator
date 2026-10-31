/** The place list (data/places-*.json): fetched once per version, kept in Cache Storage, built into an index. */

import { buildIndex } from '../places.js';

/** Month of the GeoNames dump the file was built from. Changing it means `npm run places` and a new download for everyone. */
export const PLACES_VERSION = '2026-10.1';

const CACHE_PREFIX = 'places-';
const FILE_URL = new URL(`../../data/places-${PLACES_VERSION}.json`, import.meta.url).href;

/**
 * Data saving or a 2G line: the list (about 430 KB) waits until the location field is used.
 * @param {{ saveData?: boolean, effectiveType?: string } | undefined} connection `navigator.connection`, where there is one
 */
export const defersPreload = (connection) =>
  connection?.saveData === true || connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g';

/**
 * @typedef {object} Environment
 * @property {typeof fetch} fetch
 * @property {CacheStorage | undefined} caches missing on http outside localhost
 * @property {() => Parameters<typeof defersPreload>[0]} connection
 */

/** @param {Environment} env */
export function createPlacesLoader(env) {
  /** @type {import('../places.js').PlacesIndex | null} */
  let index = null;
  /** @type {Promise<import('../places.js').PlacesIndex> | null} */
  let inFlight = null;
  let failed = false;
  const listeners = new Set();
  const changed = () => {
    for (const fn of listeners) fn();
  };

  /** Private mode can refuse Cache Storage even where it exists: then the list is fetched every time. */
  async function openCache() {
    if (!env.caches) return null;
    try {
      return await env.caches.open(`${CACHE_PREFIX}${PLACES_VERSION}`);
    } catch (error) {
      console.warn('Cache Storage unavailable', error);
      return null;
    }
  }

  async function fetchFile() {
    const cache = await openCache();
    const stored = await cache?.match(FILE_URL);
    if (stored) return stored.json();
    const response = await env.fetch(FILE_URL);
    if (!response.ok) throw new Error(`${FILE_URL}: HTTP ${response.status}`);
    if (cache) {
      // A full disk must not fail the load; the next visit downloads again
      await cache.put(FILE_URL, response.clone()).catch(console.warn);
      for (const name of await env.caches.keys())
        if (name.startsWith(CACHE_PREFIX) && name !== `${CACHE_PREFIX}${PLACES_VERSION}`) env.caches.delete(name);
    }
    return response.json();
  }

  /** The index, once loaded. One load runs at a time; after a failure the next call tries again. */
  function load() {
    if (index) return Promise.resolve(index);
    if (inFlight) return inFlight;
    failed = false;
    inFlight = fetchFile()
      .then((file) => {
        index = buildIndex(file);
        return index;
      })
      .catch((error) => {
        failed = true;
        throw error;
      })
      .finally(() => {
        inFlight = null;
        changed();
      });
    changed();
    return inFlight;
  }

  return {
    load,
    /** In the background, unless the connection asks to save data. A failure shows in `status`; use is retried by `load`. */
    preload() {
      if (defersPreload(env.connection())) return;
      load().catch(console.warn);
    },
    /** @returns {'idle' | 'loading' | 'ready' | 'error'} */
    status: () => (index ? 'ready' : inFlight ? 'loading' : failed ? 'error' : 'idle'),
    /** The index, or null while it is not loaded: for drawing without waiting. */
    loaded: () => index,
    /** Called whenever the status changes. */
    onChange: (fn) => listeners.add(fn),
  };
}

const places = createPlacesLoader({
  fetch: (url) => fetch(url),
  caches: globalThis.caches,
  connection: () => /** @type {any} */ (globalThis.navigator)?.connection,
});

export const loadPlaces = places.load;
export const preloadPlaces = places.preload;
export const placesStatus = places.status;
export const placesIfLoaded = places.loaded;
export const onPlacesChange = places.onChange;
