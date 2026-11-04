// The account's status and the availability of other shepherds' offers, over the real account and a fake client.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createAccountState } from '../../src/account-state.js';
import { DEF_CFG, DEF_MINE, DEF_TERMS, makeOffer } from '../../src/offer.js';
import { createOffers } from '../../src/offers.js';
import { ingestShared } from '../../src/schema.js';
import { createAccount } from '../../src/storage/account.js';
import { fakeClient, ME } from './fake-client.js';

const OTHER = '00000000-0000-0000-0000-00000000000b';
const id = (n) => `10000000-0000-0000-0000-00000000000${n}`;
const profile = (sharing) => ({ user_id: ME, name: 'Ana', email: 'ana@example.com', phone: null, sharing });
const ownRows = () => ({
  offers: [{ id: id(1), user_id: ME, terms: { ...DEF_TERMS } }],
  offer_mine: [{ offer_id: id(1), mine: { ...DEF_MINE }, cmp: true }],
});
const sharedRows = () => ({
  offers: [...ownRows().offers, { id: id(2), user_id: OTHER, terms: { ...DEF_TERMS, payAmount: 50 } }],
  offer_mine: ownRows().offer_mine,
  profiles: [{ user_id: OTHER, name: 'Berta', email: 'b@example.com', phone: null }],
});

/** The state over a loader that builds the real account on the fake client, as `createAccountLoader` does on the page. */
function setUp({ session, tables = ownRows(), enabled = true, wantsOthers = () => false, offers, synced = ME } = {}) {
  const fake = fakeClient({ session, tables: { ...tables, profiles: [profile(false), ...(tables.profiles ?? [])] } });
  const list = offers ?? [{ ...makeOffer(), id: id(9) }];
  const pageState = {
    offers: list,
    activeId: list[0].id,
    placeholderId: null,
    firstRun: false,
    config: { ...DEF_CFG },
  };
  const memory = new Map(synced ? [['cj.accountUser', synced]] : []);
  const store = { get: (key, fallback) => memory.get(key) ?? fallback, set: (key, value) => memory.set(key, value) };
  const others = { available: false, include: false, status: 'idle', items: [], viewId: null };
  let opened = null;
  const open = (hooks) => {
    opened ??= createAccount({
      client: fake.client,
      state: pageState,
      offerList: createOffers({ state: pageState, store }),
      persist: () => {},
      store,
      debounceMs: 5,
      onError: () => {},
      ...hooks,
    });
    return Promise.resolve(opened);
  };
  const loader = {
    open,
    async start(hooks) {
      const session = (await fake.client.auth.getSession()).data.session;
      if (!session) return null;
      const account = await open(hooks);
      return { account, ...(await account.connect()) };
    },
  };
  const online = { value: true };
  const account = createAccountState({
    enabled,
    loader,
    others,
    ingestShared,
    isOnline: () => online.value,
    wantsOthers,
  });
  const events = [];
  const statuses = [];
  account.subscribe((event) => {
    events.push(event);
    if (event === 'account') statuses.push(account.status());
  });
  return { account, others, events, statuses, pageState, store, ...fake, online, opened: () => opened };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

describe('status', () => {
  test('connecting until the saved session has been looked at, then online', async () => {
    const { account, statuses } = setUp({ tables: { ...ownRows() } });
    assert.equal(account.status(), 'connecting');
    await account.start();
    assert.equal(statuses[0], 'connecting');
    assert.equal(account.status(), 'online');
    assert.equal(account.view.user.id, ME);
    assert.equal(account.view.profile.name, 'Ana');
  });

  test('guest without a session', async () => {
    const { account, calls } = setUp({ session: null });
    await account.start();
    assert.equal(account.status(), 'guest');
    assert.deepEqual(calls, []);
  });

  test('guest and hidden when accounts are off: nothing starts', async () => {
    const { account, events } = setUp({ enabled: false });
    await account.start();
    assert.equal(account.view.enabled, false);
    assert.equal(account.status(), 'connecting');
    assert.deepEqual(events, []);
  });

  test('a failed connection ends as a guest with a line, not an exception', async () => {
    const { account, client } = setUp();
    client.auth.getSession = async () => {
      throw new Error('network');
    };
    const silence = console.error;
    console.error = () => {};
    try {
      await account.start();
    } finally {
      console.error = silence;
    }
    assert.equal(account.view.started, true);
    assert.equal(account.status(), 'guest');
    assert.equal(account.view.message, 'No se pudo conectar con la cuenta.');
  });

  test('saving, then online again; an error until the next save succeeds', async () => {
    const { account, opened, pageState, fake } = setUp();
    await account.start();
    pageState.offers[0].terms.payAmount = 5;
    opened().changed();
    assert.equal(account.status(), 'saving');
    await settle();
    assert.equal(account.status(), 'online');
    pageState.offers[0].terms.payAmount = 6;
    fake.failNext = true;
    opened().changed();
    await settle();
    assert.equal(account.status(), 'error');
    opened().changed();
    await settle();
    assert.equal(account.status(), 'online');
  });

  test('offline wins over online, and coming back writes what failed', async () => {
    const { account, online } = setUp();
    await account.start();
    online.value = false;
    account.setOnline(false);
    assert.equal(account.status(), 'offline');
    account.setOnline(true);
    assert.equal(account.status(), 'saving'); // what failed while offline is written now
    await settle();
    assert.equal(account.status(), 'online');
  });

  test('offers waiting for a decision: pending, and nothing shared', async () => {
    const { account, others, fake } = setUp({ synced: null, offers: [{ ...makeOffer(), id: id(7) }] });
    fake.failNext = true; // the upload of the browser's offer
    const silence = console.error;
    console.error = () => {};
    try {
      await account.start();
    } finally {
      console.error = silence;
    }
    assert.equal(account.status(), 'pending');
    assert.equal(account.view.pending.length, 1);
    assert.equal(others.available, false);
    await account.uploadPending();
    assert.equal(account.status(), 'online');
    assert.equal(account.view.pending.length, 0);
  });
});

describe('signing in and out', () => {
  test('signing out is a guest with the notice, no tooltip, and the others gone', async () => {
    const { account, others } = setUp({ tables: sharedRows() });
    await account.start();
    assert.equal(account.view.signedOutNotice, false);
    await account.signOut();
    assert.equal(account.status(), 'guest');
    assert.equal(account.view.signedOutNotice, true);
    assert.equal(account.view.messageIsSignedOutNotice, true);
    assert.equal(account.view.tipDismissed, true);
    assert.equal(others.available, false);
  });

  test('a failed sign-out keeps the user and writes a line', async () => {
    const { account, client } = setUp();
    await account.start();
    client.auth.signOut = async () => ({ error: new Error('offline') });
    const silence = console.error;
    console.error = () => {};
    try {
      await account.signOut();
    } finally {
      console.error = silence;
    }
    assert.equal(account.status(), 'online');
    assert.equal(account.view.message, 'No se pudo salir. Inténtalo de nuevo.');
  });

  test('a code that is not six digits is refused without a request', async () => {
    const { account, fake } = setUp({ session: null });
    await account.start();
    await account.verifyEmailCode('12 34');
    assert.equal(account.view.signIn.message, 'El código tiene 6 cifras.');
    assert.equal(fake.verified, null);
  });

  test('a code sent moves to the code stage; a sign-in completes with one signedIn', async () => {
    const { account, events, fake, client } = setUp({ session: null });
    await account.start();
    globalThis.location = { origin: 'https://x.test', pathname: '/' };
    try {
      await account.sendEmailCode('ana@example.com');
    } finally {
      delete globalThis.location;
    }
    assert.equal(account.view.signIn.stage, 'code');
    assert.equal(fake.otp.email, 'ana@example.com');
    // the session appears when the code is verified
    const real = client.auth.getSession;
    client.auth.getSession = async () => ({ data: { session: { user: { id: ME } } }, error: null });
    events.length = 0;
    await account.verifyEmailCode('123-456');
    client.auth.getSession = real;
    assert.equal(events.filter((e) => e === 'signedIn').length, 1);
    assert.equal(account.status(), 'online');
    assert.equal(account.view.signIn.stage, 'email');
  });

  test('the account replacing the browser is announced once per replacement', async () => {
    const { account, events } = setUp();
    await account.start();
    assert.equal(events.filter((e) => e === 'replaced').length, 1);
  });
});

describe('sharing availability', () => {
  test('follows the profile: on with sharing, off without, never while offers are pending', async () => {
    const { account, others, data } = setUp({ tables: sharedRows() });
    await account.start();
    assert.equal(others.available, false);
    await account.confirmShare();
    assert.equal(others.available, true);
    assert.equal(others.include, true);
    assert.equal(data.profiles.find((p) => p.user_id === ME).sharing, true);
    others.include = false;
    await account.stopSharing();
    assert.deepEqual(others, { available: false, include: false, status: 'idle', items: [], viewId: null });
  });

  test('turning sharing on only asks first; the switch off acts at once', async () => {
    const { account, data, others } = setUp({ tables: sharedRows() });
    await account.start();
    await account.toggleSharing(true);
    assert.equal(account.view.confirm, 'share');
    assert.equal(data.profiles.find((p) => p.user_id === ME).sharing, false);
    await account.confirmShare();
    assert.equal(account.view.confirm, null);
    await account.toggleSharing(false);
    assert.equal(others.available, false);
  });

  test('a change fetches when Comparar is in view, and a change does not otherwise', async () => {
    let inView = false;
    const { account, others } = setUp({ tables: sharedRows(), wantsOthers: () => inView });
    await account.start();
    await account.confirmShare();
    await settle();
    assert.equal(others.status, 'idle', 'not in view: no fetch from the change');
    await account.stopSharing();
    inView = true;
    await account.confirmShare();
    await settle();
    assert.equal(others.status, 'ready');
    assert.equal(others.items.length, 1);
    assert.equal(others.items[0].o.id, id(2));
  });

  test('loadOthers marks a failure and keeps the account usable', async () => {
    const { account, others, client } = setUp({ tables: sharedRows() });
    await account.start();
    await account.confirmShare();
    const real = client.from;
    client.from = (table) => {
      if (table === 'profiles') throw new Error('network');
      return real(table);
    };
    const silence = console.error;
    console.error = () => {};
    try {
      await account.loadOthers();
    } finally {
      console.error = silence;
    }
    assert.equal(others.status, 'error');
    assert.equal(account.status(), 'online');
  });

  test('a repaint never starts a fetch: only changes do', async () => {
    const { account, others } = setUp({ tables: sharedRows(), wantsOthers: () => true });
    await account.start();
    await account.confirmShare();
    await settle();
    others.status = 'idle';
    account.dismissTip(); // an account event, availability unchanged
    await settle();
    assert.equal(others.status, 'idle');
  });
});
