/**
 * The Supabase account (ADR-0006). Signed in, the account is the source of truth and localStorage is a cache; signed
 * out, the page never touches the network and the bundle is not even loaded.
 */

import { DEF_TERMS, makeOffer, SCHEMA_VERSION } from '../offer.js';
import { ingestSaved } from '../saved.js';
import { onSave, saveConfig, saveOffers, state, store } from '../state.js';
import { ACCOUNT_CONFIG } from './account-config.js';

/** Where supabase-js keeps its session in localStorage; known, so a saved session is found without loading it. */
const SESSION_KEY = 'cj.session';
/** Set while the Google redirect is under way: the page loads the bundle on return to finish the login. */
const RETURNING_KEY = 'cj.accountReturn';
/** The user whose account this browser's offers last matched. */
const SYNCED_KEY = 'cj.accountUser';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROFILE_FIELDS = ['name', 'email', 'phone', 'sharing'];

/** The data of a supabase-js result, or its error thrown. */
function unwrap({ data, error }) {
  if (error) throw error;
  return data;
}

/** What is written for an offer besides its id, to tell whether it changed. */
const fingerprint = (offer) => JSON.stringify([offer.terms, offer.mine, offer.cmp !== false]);

/**
 * The account behind a supabase-js client.
 * @param {object} deps
 * @param {any} deps.client a supabase-js client
 * @param {{ offers: any[], activeId: string, placeholderId: string | null, firstRun: boolean, config: any }} deps.state
 * @param {() => void} deps.persist writes offers and settings to localStorage
 * @param {{ get(key: string, fallback: any): any, set(key: string, value: any): void }} deps.store
 * @param {() => void} [deps.onReplaced] the account's copy has replaced the offers: repaint
 * @param {(error: unknown) => void} [deps.onError] a background save failed; it is retried with the next change
 * @param {number} [deps.debounceMs]
 */
export function createAccount({
  client,
  state,
  persist,
  store,
  onReplaced = () => {},
  onError = console.error,
  debounceMs = 1500,
}) {
  /** @type {{ id: string } | null} */
  let user = null;
  /** Only while true are changes written. */
  let syncing = false;
  let timer = 0;
  let queue = Promise.resolve();
  /** What the account holds: fingerprint per offer id, and the settings (null: no row yet). */
  const known = { offers: new Map(), cfg: /** @type {string | null} */ (null) };
  /** First sign-in on a browser with offers the account lacks: kept until uploaded or discarded. */
  let pending = /** @type {{ account: { offers: any[], cfg: any }, extras: any[] } | null} */ (null);

  const ownOffers = () => state.offers.filter((o) => o.id !== state.placeholderId);

  /** Gives offers whose id is not a uuid a new one, locally too, since the server needs uuids. */
  function remapIds(offers) {
    let remapped = false;
    for (const offer of offers) {
      if (UUID.test(offer.id)) continue;
      const newId = crypto.randomUUID();
      if (state.activeId === offer.id) state.activeId = newId;
      offer.id = newId;
      remapped = true;
    }
    if (remapped) persist();
  }

  async function readOwn() {
    const [offerRows, mineRows, settingsRow] = await Promise.all([
      client.from('offers').select('id, terms').eq('user_id', user?.id),
      client.from('offer_mine').select('offer_id, mine, cmp'),
      client.from('settings').select('cfg').eq('user_id', user?.id).maybeSingle(),
    ]);
    const mineById = new Map(unwrap(mineRows).map((row) => [row.offer_id, row]));
    const offers = unwrap(offerRows).map((row) => ({
      id: row.id,
      cmp: mineById.get(row.id)?.cmp ?? true,
      terms: row.terms,
      mine: mineById.get(row.id)?.mine ?? {},
    }));
    return { offers, cfg: unwrap(settingsRow)?.cfg ?? null };
  }

  async function writeOffers(offers) {
    if (!offers.length) return;
    const updatedAt = new Date().toISOString();
    unwrap(
      await client.from('offers').upsert(
        offers.map((o) => ({
          id: o.id,
          user_id: user?.id,
          terms: o.terms,
          schema_version: SCHEMA_VERSION,
          updated_at: updatedAt,
        })),
      ),
    );
    unwrap(
      await client
        .from('offer_mine')
        .upsert(offers.map((o) => ({ offer_id: o.id, mine: o.mine, cmp: o.cmp !== false }))),
    );
    for (const o of offers) known.offers.set(o.id, fingerprint(o));
  }

  async function writeConfig() {
    unwrap(
      await client
        .from('settings')
        .upsert({ user_id: user?.id, cfg: state.config, updated_at: new Date().toISOString() }),
    );
    known.cfg = JSON.stringify(state.config);
  }

  /** The account's offers and settings become the browser's, and changes start being written. */
  function replaceWith(account) {
    const position = (id) => {
      const at = state.offers.findIndex((o) => o.id === id);
      return at < 0 ? Number.POSITIVE_INFINITY : at;
    };
    const ingested = ingestSaved(account, { fallbackCfg: state.config });
    const offers = ingested.offers.sort((a, b) => position(a.id) - position(b.id));
    syncing = false;
    state.offers = offers.length ? offers : [makeOffer()];
    if (!state.offers.some((o) => o.id === state.activeId)) state.activeId = state.offers[0].id;
    state.config = ingested.cfg;
    state.placeholderId = null;
    state.firstRun = false;
    persist();
    onReplaced();
    // After onReplaced: showing an offer may complete its fields, which is not a change to write.
    known.offers = new Map(ownOffers().map((o) => [o.id, fingerprint(o)]));
    known.cfg = account.cfg ? JSON.stringify(state.config) : null;
    store.set(SYNCED_KEY, user?.id);
    syncing = true;
  }

  /** Writes whatever differs from what the account holds. */
  async function flushNow() {
    if (!syncing) return;
    const offers = ownOffers();
    remapIds(offers);
    const changed = offers.filter((o) => known.offers.get(o.id) !== fingerprint(o));
    const removed = [...known.offers.keys()].filter((id) => !offers.some((o) => o.id === id));
    await writeOffers(changed);
    if (removed.length) {
      unwrap(await client.from('offers').delete().in('id', removed));
      for (const id of removed) known.offers.delete(id);
    }
    if (known.cfg !== JSON.stringify(state.config)) await writeConfig();
  }

  function flush() {
    clearTimeout(timer);
    const run = queue.then(flushNow);
    // The caller of `run` gets the error; the chain must stay usable for the retry.
    queue = run.catch(() => {});
    return run;
  }

  function stop() {
    syncing = false;
    clearTimeout(timer);
    pending = null;
    store.set(SYNCED_KEY, null);
  }

  return {
    /** The signed-in user, or null. */
    currentUser: () => user,

    /** Starts the Google login; the browser leaves the page and comes back signed in. */
    async signIn() {
      store.set(RETURNING_KEY, true);
      unwrap(
        await client.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: location.origin + location.pathname },
        }),
      );
    },

    async signOut() {
      stop();
      user = null;
      unwrap(await client.auth.signOut());
    },

    /**
     * Reads the account and, unless this browser holds offers it lacks, makes it the browser's copy and starts saving.
     * Returns the user (null if signed out) and the offers waiting for `uploadPending` or `discardPending`.
     */
    async connect() {
      store.set(RETURNING_KEY, null);
      const { session } = unwrap(await client.auth.getSession());
      user = session?.user ?? null;
      if (!user) return { user, pending: [] };
      const account = await readOwn();
      const firstOnThisBrowser = store.get(SYNCED_KEY, null) !== user.id;
      const extras = ownOffers().filter((o) => !account.offers.some((x) => x.id === o.id));
      if (firstOnThisBrowser && extras.length) {
        pending = { account, extras };
        return { user, pending: extras };
      }
      replaceWith(account);
      return { user, pending: [] };
    },

    /** The browser's offers that the account lacks, waiting for the user's confirmation. */
    pendingOffers: () => pending?.extras ?? [],

    /** Uploads them (merge by id) and keeps them next to the account's offers. */
    async uploadPending() {
      if (!pending) return;
      const { account, extras } = pending;
      remapIds(extras);
      await writeOffers(extras);
      pending = null;
      replaceWith({ offers: [...account.offers, ...extras], cfg: account.cfg });
    },

    /** Drops them: the account's copy replaces the browser's. */
    discardPending() {
      if (!pending) return;
      const { account } = pending;
      pending = null;
      replaceWith(account);
    },

    /** A local change was saved: the changed offers are written after a pause. */
    changed() {
      if (!syncing) return;
      clearTimeout(timer);
      timer = setTimeout(() => flush().catch(onError), debounceMs);
    },

    /** Writes the pending changes now. */
    flush,

    /** `[{ offer: { id, terms }, sharer }]`: other users' shared offers and who shared them. */
    async sharedOffers() {
      const [offerRows, profileRows] = await Promise.all([
        client.from('offers').select('id, user_id, terms').neq('user_id', user?.id),
        client.from('profiles').select('user_id, name, email, phone').neq('user_id', user?.id),
      ]);
      const sharers = new Map(unwrap(profileRows).map((p) => [p.user_id, p]));
      return unwrap(offerRows).map((row) => ({
        offer: { id: row.id, terms: { ...DEF_TERMS, ...row.terms } },
        sharer: sharers.get(row.user_id) ?? { user_id: row.user_id },
      }));
    },

    /** `{ name, email, phone, sharing }` of the signed-in user. */
    async profile() {
      return unwrap(await client.from('profiles').select(PROFILE_FIELDS.join(', ')).eq('user_id', user?.id).single());
    },

    /** Updates the given profile fields and returns the profile. */
    async updateProfile(fields) {
      const update = Object.fromEntries(PROFILE_FIELDS.filter((f) => f in fields).map((f) => [f, fields[f]]));
      return unwrap(
        await client
          .from('profiles')
          .update({ ...update, updated_at: new Date().toISOString() })
          .eq('user_id', user?.id)
          .select(PROFILE_FIELDS.join(', '))
          .single(),
      );
    },

    /** Deletes the offers (with their own figures), settings and profile in the account; the browser keeps its copy. */
    async deleteMyData() {
      stop();
      unwrap(await client.from('offers').delete().eq('user_id', user?.id));
      unwrap(await client.from('settings').delete().eq('user_id', user?.id));
      unwrap(await client.from('profiles').delete().eq('user_id', user?.id));
    },

    /** Deletes the account itself, with everything in it, and signs out. */
    async deleteAccount() {
      stop();
      unwrap(await client.rpc('delete_my_account'));
      user = null;
      unwrap(await client.auth.signOut({ scope: 'local' }));
    },
  };
}

/* --- Loading it on the page --- */

/** Injects the vendored UMD bundle (a classic script that sets `window.supabase`). */
export function loadSupabase() {
  if (window.supabase) return Promise.resolve(window.supabase);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('../../vendor/supabase/supabase.js', import.meta.url).href;
    script.onload = () => resolve(window.supabase);
    script.onerror = () => reject(new Error('supabase-js did not load'));
    document.head.append(script);
  });
}

/** @type {Promise<ReturnType<typeof createAccount>> | null} */
let opening = null;
/** Called by the page when the account's offers replace the browser's. */
let onReplacedByPage = () => {};

/** The account, created (and the bundle loaded) on first use. */
function open({ config, loadBundle }) {
  opening ??= loadBundle()
    .then((supabase) => {
      const client = supabase.createClient(config.url, config.anonKey, {
        auth: { storageKey: SESSION_KEY, flowType: 'pkce' },
      });
      const account = createAccount({
        client,
        state,
        persist: () => {
          saveOffers();
          saveConfig();
        },
        store,
        onReplaced: () => onReplacedByPage(),
      });
      onSave(account.changed);
      return account;
    })
    .catch((error) => {
      opening = null;
      throw error;
    });
  return opening;
}

/**
 * Called once at startup. With no project configured, or no saved session and no login in progress, it does nothing
 * (no request, no bundle) and returns null. Otherwise `{ account, user, pending }` once connected.
 * @param {{ config?: typeof ACCOUNT_CONFIG, loadBundle?: () => Promise<any>, onReplaced?: () => void }} [options]
 */
export async function startAccount({ config = ACCOUNT_CONFIG, loadBundle = loadSupabase, onReplaced } = {}) {
  if (onReplaced) onReplacedByPage = onReplaced;
  if (!config.url || !config.anonKey) return null;
  if (!store.get(SESSION_KEY, null) && !store.get(RETURNING_KEY, null)) return null;
  const account = await open({ config, loadBundle });
  return { account, ...(await account.connect()) };
}

/** The Ajustes button: loads the bundle and goes to Google. */
export async function signInWithGoogle({ config = ACCOUNT_CONFIG, loadBundle = loadSupabase } = {}) {
  if (!config.url || !config.anonKey) throw new Error('Accounts are off: no project in account-config.js');
  const account = await open({ config, loadBundle });
  await account.signIn();
}
