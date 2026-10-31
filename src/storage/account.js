/**
 * The Supabase account (ADR-0006). Signed in, the account is the source of truth and localStorage is a cache; signed
 * out, the page never touches the network and the bundle is not even loaded.
 */

import { DEF_CFG, DEF_TERMS, makeOffer, SCHEMA_VERSION } from '../offer.js';
import { ingestSaved } from '../saved.js';
import { KEY, onSave, saveConfig, saveOffers, state, store } from '../state.js';
import { ACCOUNT_CONFIG } from './account-config.js';

/** Where supabase-js keeps its session in localStorage; known, so a saved session is found without loading it. */
const SESSION_KEY = 'cj.session';
/** Set while the Google redirect is under way: the page loads the bundle on return to finish the login. */
const RETURNING_KEY = 'cj.accountReturn';
/** The user whose account this browser's offers last matched. */
const SYNCED_KEY = 'cj.accountUser';
/** What this browser holds that the account does not, `{ user, changed: ids, removed: ids, cfg }`: survives a reload. */
const UNSYNCED_KEY = 'cj.accountUnsynced';

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
 * @param {(status: 'saving' | 'saved' | 'error') => void} [deps.onStatus] how the background saving goes
 * @param {number} [deps.debounceMs]
 */
export function createAccount({
  client,
  state,
  persist,
  store,
  onReplaced = () => {},
  onError = console.error,
  onStatus = () => {},
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
  /** First sign-in on a browser with offers the account lacks, whose upload failed: kept until retried or discarded. */
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

  /** Snapshots first: an edit made during the request must not be recorded as written. */
  async function writeOffers(offers) {
    if (!offers.length) return;
    const updatedAt = new Date().toISOString();
    const written = structuredClone(
      offers.map((o) => ({ id: o.id, terms: o.terms, mine: o.mine, cmp: o.cmp !== false })),
    );
    const fingerprints = offers.map((o) => [o.id, fingerprint(o)]);
    unwrap(
      await client.from('offers').upsert(
        written.map((o) => ({
          id: o.id,
          user_id: user?.id,
          terms: o.terms,
          schema_version: SCHEMA_VERSION,
          updated_at: updatedAt,
        })),
      ),
    );
    unwrap(await client.from('offer_mine').upsert(written.map((o) => ({ offer_id: o.id, mine: o.mine, cmp: o.cmp }))));
    for (const [offerId, print] of fingerprints) known.offers.set(offerId, print);
  }

  async function writeConfig() {
    const cfg = structuredClone(state.config);
    unwrap(await client.from('settings').upsert({ user_id: user?.id, cfg, updated_at: new Date().toISOString() }));
    known.cfg = JSON.stringify(cfg);
  }

  /** What differs between the browser and what the account holds. */
  function unsynced() {
    const offers = ownOffers();
    return {
      changed: offers.filter((o) => known.offers.get(o.id) !== fingerprint(o)),
      removed: [...known.offers.keys()].filter((offerId) => !offers.some((o) => o.id === offerId)),
      cfg: known.cfg !== JSON.stringify(state.config),
    };
  }

  /** Records `unsynced()` where a reload finds it, so offline edits and deletions still reach the account. */
  function saveUnsynced() {
    const { changed, removed, cfg } = unsynced();
    const any = changed.length || removed.length || cfg;
    store.set(UNSYNCED_KEY, any ? { user: user?.id, changed: changed.map((o) => o.id), removed, cfg } : null);
  }

  /**
   * The account's offers and settings become the browser's, and changes start being written. `left` (from
   * `saveUnsynced`) are local changes the account lacks: they are kept over the account's copy, and written next.
   */
  function replaceWith(account, left = null) {
    const position = (id) => {
      const at = state.offers.findIndex((o) => o.id === id);
      return at < 0 ? Number.POSITIVE_INFINITY : at;
    };
    const ingested = ingestSaved(account, { fallbackCfg: state.config });
    const accountIds = new Set(ingested.offers.map((o) => o.id));
    let { cfg } = ingested;
    let merged = ingested.offers;
    if (left) {
      const local = new Map(ownOffers().map((o) => [o.id, o]));
      const kept = left.changed.filter((offerId) => local.has(offerId));
      merged = merged
        .filter((o) => !left.removed.includes(o.id))
        .map((o) => (kept.includes(o.id) ? local.get(o.id) : o));
      merged.push(...kept.filter((offerId) => !accountIds.has(offerId)).map((offerId) => local.get(offerId)));
      if (left.cfg) cfg = state.config;
    }
    const offers = merged.sort((a, b) => position(a.id) - position(b.id));
    syncing = false;
    // An empty account starts like a first visit: a placeholder, replaced by the template picked
    const empty = !offers.length;
    state.offers = empty ? [makeOffer()] : offers;
    if (!state.offers.some((o) => o.id === state.activeId)) state.activeId = state.offers[0].id;
    state.config = cfg;
    state.placeholderId = empty ? state.offers[0].id : null;
    state.firstRun = empty;
    persist();
    onReplaced();
    // After onReplaced: showing an offer may complete its fields, which is not a change to write.
    known.offers = new Map(ownOffers().map((o) => [o.id, fingerprint(o)]));
    known.cfg = account.cfg ? JSON.stringify(ingested.cfg) : null;
    if (left) {
      for (const offerId of left.changed) known.offers.delete(offerId);
      for (const offerId of left.removed) if (accountIds.has(offerId)) known.offers.set(offerId, '');
      if (left.cfg) known.cfg = null;
    }
    store.set(SYNCED_KEY, user?.id);
    syncing = true;
    saveUnsynced();
  }

  /** Writes whatever differs from what the account holds. */
  async function flushNow() {
    if (!syncing) return;
    const offers = ownOffers();
    remapIds(offers);
    saveUnsynced(); // after remapIds, so the ids kept are the ones written
    const { changed, removed } = unsynced();
    await writeOffers(changed);
    if (removed.length) {
      unwrap(await client.from('offers').delete().in('id', removed));
      for (const id of removed) known.offers.delete(id);
    }
    if (unsynced().cfg) await writeConfig();
    saveUnsynced();
  }

  function flush() {
    clearTimeout(timer);
    const run = queue.then(flushNow);
    // The caller of `run` gets the error; the chain must stay usable for the retry.
    queue = run.catch(() => {});
    return run;
  }

  /** A flush whose failure is reported, not thrown; the changes stay unsynced and go with the next one. */
  function saveInBackground() {
    return flush().then(
      () => onStatus('saved'),
      (error) => {
        onError(error);
        onStatus('error');
      },
    );
  }

  /** Uploads the pending offers (merge by id) and keeps them next to the account's offers. */
  async function uploadPending() {
    if (!pending) return;
    const { account, extras } = pending;
    remapIds(extras);
    await writeOffers(extras);
    pending = null;
    replaceWith({ offers: [...account.offers, ...extras], cfg: account.cfg });
  }

  /**
   * Signed out, the browser starts like a first visit: the next user must not inherit (and upload) these offers.
   * Not persisted through `persist`, whose placeholder would be saved as a real offer.
   */
  function forgetBrowserCopy() {
    const placeholder = makeOffer();
    Object.assign(state, {
      offers: [placeholder],
      activeId: placeholder.id,
      placeholderId: placeholder.id,
      firstRun: true,
      config: { ...DEF_CFG },
    });
    onReplaced();
    // After onReplaced: showing the placeholder saves it, and a saved one is no longer a first visit.
    for (const key of [KEY.offers, KEY.active, KEY.cfg]) store.set(key, null);
  }

  function stop() {
    syncing = false;
    clearTimeout(timer);
    pending = null;
    store.set(SYNCED_KEY, null);
    store.set(UNSYNCED_KEY, null);
  }

  return {
    /** The signed-in user, or null. */
    currentUser: () => user,

    /** Google's ID token, from its own button (ADR-0009), with the nonce whose hash Google signed into it. */
    async signInWithGoogleToken(token, nonce) {
      unwrap(await client.auth.signInWithIdToken({ provider: 'google', token, nonce }));
    },

    /** Emails a six-digit code, and a link back to this page that works in this same browser. */
    async sendEmailCode(email) {
      store.set(RETURNING_KEY, true);
      unwrap(
        await client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } }),
      );
    },

    async verifyEmailCode(email, code) {
      unwrap(await client.auth.verifyOtp({ email, token: code, type: 'email' }));
    },

    /** The fallback when Google's script does not load: the browser leaves for Google and comes back signed in. */
    async signIn() {
      store.set(RETURNING_KEY, true);
      unwrap(
        await client.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: location.origin + location.pathname },
        }),
      );
    },

    /** Saves what is pending, then signs out; if either fails nothing changes and the error is thrown. */
    async signOut() {
      try {
        await flush();
      } catch (error) {
        onStatus('error');
        throw error;
      }
      unwrap(await client.auth.signOut());
      stop();
      user = null;
      forgetBrowserCopy();
    },

    /**
     * Reads the account, uploads the offers only this browser holds if it has not synced with this user before, makes
     * the account the browser's copy and starts saving. Returns the user (null if signed out) and, if that upload
     * failed, the offers waiting for `uploadPending` or `discardPending`.
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
        try {
          await uploadPending();
        } catch (error) {
          onError(error);
          return { user, pending: extras };
        }
        return { user, pending: [] };
      }
      const left = store.get(UNSYNCED_KEY, null);
      const unsyncedHere = left?.user === user.id ? left : null;
      replaceWith(account, unsyncedHere);
      if (unsyncedHere) {
        onStatus('saving');
        await saveInBackground();
      }
      return { user, pending: [] };
    },

    /** The browser's offers that the account lacks, whose upload failed. */
    pendingOffers: () => pending?.extras ?? [],

    /** Tries the upload again. */
    uploadPending,

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
      saveUnsynced();
      timer = setTimeout(saveInBackground, debounceMs);
      onStatus('saving');
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
/** Called by the page as background saves start, succeed or fail. */
let onStatusByPage = (_status) => {};

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
        onStatus: (status) => onStatusByPage(status),
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
 * `onReplaced` and `onStatus` also serve an account opened later by a sign-in button.
 * @param {{
 *   config?: typeof ACCOUNT_CONFIG,
 *   loadBundle?: () => Promise<any>,
 *   onReplaced?: () => void,
 *   onStatus?: (status: 'saving' | 'saved' | 'error') => void,
 * }} [options]
 */
export async function startAccount({ config = ACCOUNT_CONFIG, loadBundle = loadSupabase, onReplaced, onStatus } = {}) {
  if (onReplaced) onReplacedByPage = onReplaced;
  if (onStatus) onStatusByPage = onStatus;
  if (!config.url || !config.anonKey) return null;
  // An emailed link opened in this browser comes back with a PKCE code; supabase-js finishes the login from the URL.
  const linkFollowed = new URLSearchParams(globalThis.location?.search).has('code');
  if (!store.get(SESSION_KEY, null) && !store.get(RETURNING_KEY, null) && !linkFollowed) return null;
  const account = await open({ config, loadBundle });
  return { account, ...(await account.connect()) };
}

/** The account for a sign-in button: loads the bundle on first use. */
export function openAccount({ config = ACCOUNT_CONFIG, loadBundle = loadSupabase } = {}) {
  if (!config.url || !config.anonKey) throw new Error('Accounts are off: no project in account-config.js');
  return open({ config, loadBundle });
}
