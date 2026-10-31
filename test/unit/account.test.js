// The account sync against a fake supabase-js client. Run with `npm run test:unit`.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DEF_CFG, DEF_MINE, DEF_TERMS, makeOffer, SCHEMA_VERSION } from '../../src/offer.js';
import { createAccount, startAccount } from '../../src/storage/account.js';

const ME = '00000000-0000-0000-0000-00000000000a';
const OTHER = '00000000-0000-0000-0000-00000000000b';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const id = (n) => `10000000-0000-0000-0000-00000000000${n}`;

/**
 * Only the supabase-js calls the account uses, over in-memory tables. `calls` records every write as
 * `{ table, op, rows | ids }`; `fake.failNext` makes the next write fail once.
 */
function fakeClient({ session = { user: { id: ME } }, tables = {} } = {}) {
  const data = { offers: [], offer_mine: [], settings: [], profiles: [], ...tables };
  const calls = [];
  const fake = { failNext: false, signedOut: false, oauth: null, idToken: null, otp: null, verified: null, rpc: [] };
  const keyOf = { offer_mine: 'offer_id', offers: 'id', settings: 'user_id', profiles: 'user_id' };
  const matches = { eq: (a, b) => a === b, neq: (a, b) => a !== b, in: (a, list) => list.includes(a) };

  /** A query builder: awaiting it runs it, like supabase-js. */
  class Query {
    op = 'select';
    filters = [];
    payload = null;
    expectOne = false;
    columns = null;

    constructor(table) {
      this.table = table;
    }

    select(columns = '*') {
      this.columns = columns === '*' ? null : columns.split(',').map((c) => c.trim());
      return this;
    }
    eq(column, value) {
      this.filters.push(['eq', column, value]);
      return this;
    }
    neq(column, value) {
      this.filters.push(['neq', column, value]);
      return this;
    }
    in(column, value) {
      this.filters.push(['in', column, value]);
      return this;
    }
    upsert(rows) {
      this.op = 'upsert';
      this.payload = Array.isArray(rows) ? rows : [rows];
      return this;
    }
    delete() {
      this.op = 'delete';
      return this;
    }
    update(payload) {
      this.op = 'update';
      this.payload = payload;
      return this;
    }
    maybeSingle() {
      this.expectOne = true;
      return this;
    }
    single() {
      this.expectOne = true;
      return this;
    }
    // biome-ignore lint/suspicious/noThenProperty: awaiting a query runs it, as in supabase-js
    then(resolve, reject) {
      return Promise.resolve(this.run()).then(resolve, reject);
    }

    project(row) {
      if (!this.columns) return row;
      return Object.fromEntries(this.columns.map((column) => [column, row[column]]));
    }

    run() {
      const { table, op } = this;
      const rows = data[table].filter((row) =>
        this.filters.every(([kind, col, value]) => matches[kind](row[col], value)),
      );
      if (op !== 'select' && fake.failNext) {
        fake.failNext = false;
        return { data: null, error: new Error('network') };
      }
      if (op === 'upsert') {
        calls.push({ table, op, rows: this.payload });
        for (const row of this.payload) {
          const at = data[table].findIndex((r) => r[keyOf[table]] === row[keyOf[table]]);
          if (at < 0) data[table].push({ ...row });
          else data[table][at] = { ...data[table][at], ...row };
        }
        return { data: null, error: null };
      }
      if (op === 'delete') {
        calls.push({ table, op, ids: rows.map((r) => r.id ?? r.user_id) });
        data[table] = data[table].filter((r) => !rows.includes(r));
        return { data: null, error: null };
      }
      if (op === 'update') for (const row of rows) Object.assign(row, this.payload);
      const result = rows.map((row) => this.project(row));
      return { data: this.expectOne ? (result[0] ?? null) : result, error: null };
    }
  }

  const client = {
    from: (table) => new Query(table),
    async rpc(name) {
      fake.rpc.push(name);
      return { data: null, error: null };
    },
    auth: {
      async getSession() {
        return { data: { session }, error: null };
      },
      async signInWithOAuth(args) {
        fake.oauth = args;
        return { data: {}, error: null };
      },
      async signInWithIdToken(args) {
        fake.idToken = args;
        return { data: {}, error: null };
      },
      async signInWithOtp(args) {
        fake.otp = args;
        return { data: {}, error: null };
      },
      async verifyOtp(args) {
        fake.verified = args;
        return { data: {}, error: args.token === '000000' ? new Error('Token has expired or is invalid') : null };
      },
      async signOut() {
        fake.signedOut = true;
        return { error: null };
      },
    },
  };
  return { client, data, calls, fake };
}

/** An account row as the two tables hold it: the offer and its own figures. */
const accountRow = (n, terms = {}, mine = {}, cmp = true) => [
  { id: id(n), user_id: ME, terms: { ...DEF_TERMS, ...terms } },
  { offer_id: id(n), mine: { ...DEF_MINE, ...mine }, cmp },
];

const accountTables = (...rows) => ({ offers: rows.map((r) => r[0]), offer_mine: rows.map((r) => r[1]) });

function setUp({ tables, session, localOffers, synced = ME } = {}) {
  const offers = localOffers ?? [{ ...makeOffer(), id: id(9) }];
  const state = { offers, activeId: offers[0].id, placeholderId: null, firstRun: false, config: { ...DEF_CFG } };
  const memory = new Map(synced ? [['cj.accountUser', synced]] : []);
  const store = { get: (key, fallback) => memory.get(key) ?? fallback, set: (key, value) => memory.set(key, value) };
  const persisted = [];
  const replaced = [];
  const errors = [];
  const statuses = [];
  const fakeAll = fakeClient({ session, tables });
  const account = createAccount({
    client: fakeAll.client,
    state,
    store,
    persist: () => persisted.push(state.offers.map((o) => o.id)),
    onReplaced: () => replaced.push(state.offers.map((o) => o.id)),
    onError: (e) => errors.push(e),
    onStatus: (status) => statuses.push(status),
    debounceMs: 5,
  });
  return { account, state, store: memory, persisted, replaced, errors, statuses, ...fakeAll };
}

const ids = (state) => state.offers.map((o) => o.id);

describe('nothing is loaded or called without an account', () => {
  const noBundle = () => assert.fail('the bundle must not load');

  test('with a null config', async () => {
    assert.equal(await startAccount({ config: { url: null, anonKey: null }, loadBundle: noBundle }), null);
  });

  test('with a config but no saved session', async () => {
    const config = { url: 'https://x.supabase.co', anonKey: 'k' };
    assert.equal(await startAccount({ config, loadBundle: noBundle }), null);
  });

  test('with a saved session the bundle loads and the session is read', async () => {
    globalThis.localStorage = { getItem: (key) => (key === 'cj.session' ? '{"a":1}' : null), setItem() {} };
    try {
      const { client, calls } = fakeClient({ session: null });
      let loaded = 0;
      const loadBundle = async () => {
        loaded++;
        return { createClient: () => client };
      };
      const config = { url: 'https://x.supabase.co', anonKey: 'k' };
      const result = await startAccount({ config, loadBundle });
      assert.equal(loaded, 1);
      assert.equal(result?.user, null);
      assert.deepEqual(calls, []);
    } finally {
      delete globalThis.localStorage;
    }
  });

  test('a client with no session reads and writes nothing', async () => {
    const { account, calls, state } = setUp({ session: null });
    const before = structuredClone(state.offers);
    assert.deepEqual(await account.connect(), { user: null, pending: [] });
    account.changed();
    await account.flush();
    assert.deepEqual(calls, []);
    assert.deepEqual(state.offers, before);
  });
});

describe('sign in', () => {
  test("hands Google's ID token and the raw nonce to Supabase", async () => {
    const { account, fake } = setUp();
    await account.signInWithGoogleToken('jwt', 'raw-nonce');
    assert.deepEqual(fake.idToken, { provider: 'google', token: 'jwt', nonce: 'raw-nonce' });
  });

  test('emails a code with a link back to this page, and checks the code', async () => {
    globalThis.location = { origin: 'https://example.org', pathname: '/app/' };
    try {
      const { account, fake, store } = setUp();
      await account.sendEmailCode('ana@example.com');
      assert.deepEqual(fake.otp, {
        email: 'ana@example.com',
        options: { emailRedirectTo: 'https://example.org/app/' },
      });
      assert.equal(store.get('cj.accountReturn'), true);
      await account.verifyEmailCode('ana@example.com', '123456');
      assert.deepEqual(fake.verified, { email: 'ana@example.com', token: '123456', type: 'email' });
      await assert.rejects(account.verifyEmailCode('ana@example.com', '000000'), /invalid/);
    } finally {
      delete globalThis.location;
    }
  });

  test('goes to Google and comes back to this page', async () => {
    globalThis.location = { origin: 'https://example.org', pathname: '/app/' };
    try {
      const { account, fake, store } = setUp();
      await account.signIn();
      assert.equal(fake.oauth.provider, 'google');
      assert.equal(fake.oauth.options.redirectTo, 'https://example.org/app/');
      assert.equal(store.get('cj.accountReturn'), true);
    } finally {
      delete globalThis.location;
    }
  });

  test("the account's offers and settings replace the browser's", async () => {
    const { account, state, persisted, replaced } = setUp({
      tables: {
        ...accountTables(accountRow(1, { payAmount: 50 }, { name: 'Nube' }, false), accountRow(2)),
        settings: [{ user_id: ME, cfg: { others: 7 } }],
      },
    });
    const { user, pending } = await account.connect();
    assert.equal(user?.id, ME);
    assert.deepEqual(pending, []);
    assert.deepEqual(ids(state), [id(1), id(2)]);
    assert.equal(state.offers[0].terms.payAmount, 50);
    assert.equal(state.offers[0].mine.name, 'Nube');
    assert.equal(state.offers[0].cmp, false);
    assert.equal(state.config.others, 7);
    assert.equal(state.activeId, id(1));
    assert.equal(persisted.length, 1);
    assert.equal(replaced.length, 1);
  });

  test('other users rows in the same tables are not taken', async () => {
    const tables = accountTables(accountRow(1));
    tables.offers.push({ id: id(5), user_id: OTHER, terms: DEF_TERMS });
    const { account, state } = setUp({ tables });
    await account.connect();
    assert.deepEqual(ids(state), [id(1)]);
  });

  test('an empty account starts like a first visit, with a placeholder never written; the settings are uploaded', async () => {
    const { account, state, calls } = setUp();
    await account.connect();
    assert.equal(state.offers.length, 1);
    assert.equal(state.placeholderId, state.offers[0].id);
    assert.equal(state.firstRun, true);
    await account.flush();
    assert.deepEqual(
      calls.map((c) => c.table),
      ['settings'],
    );
  });

  test('known offers keep their place', async () => {
    const { account, state } = setUp({
      localOffers: [
        { ...makeOffer(), id: id(2) },
        { ...makeOffer(), id: id(1) },
      ],
      tables: accountTables(accountRow(1), accountRow(2), accountRow(3)),
    });
    await account.connect();
    assert.deepEqual(ids(state), [id(2), id(1), id(3)]);
  });
});

describe('first sign-in on a browser with offers', () => {
  const local = () => [
    { ...makeOffer({ payAmount: 1 }, { name: 'Vieja' }), id: 'o1abc' },
    { ...makeOffer({ payAmount: 2 }), id: id(7) },
  ];
  const first = () => setUp({ synced: null, localOffers: local(), tables: accountTables(accountRow(1)) });

  test('uploads them without asking, with new uuids, beside the account offers', async () => {
    const { account, state, calls, data, persisted, store } = first();
    state.activeId = 'o1abc';
    assert.deepEqual((await account.connect()).pending, []);

    const after = ids(state);
    assert.equal(after.length, 3);
    assert.ok(after.every((x) => UUID.test(x)));
    assert.ok(!after.includes('o1abc'));
    assert.ok(after.includes(id(7)) && after.includes(id(1)));
    assert.equal(state.activeId, state.offers.find((o) => o.mine.name === 'Vieja')?.id);
    assert.ok(persisted.length >= 1);
    assert.deepEqual(data.offers.map((o) => o.id).sort(), [...after].sort());
    assert.equal(data.offer_mine.find((m) => m.mine.name === 'Vieja')?.offer_id, state.activeId);
    assert.ok(calls.every((c) => c.op === 'upsert'));
    assert.equal(store.get('cj.accountUser'), ME);
  });

  test('a failed upload lists them and leaves the browser offers in place', async () => {
    const { account, state, fake, errors, store } = first();
    fake.failNext = true;
    const result = await account.connect();
    assert.deepEqual(
      result.pending.map((o) => o.mine.name),
      ['Vieja', state.offers[1].mine.name],
    );
    assert.deepEqual(account.pendingOffers(), result.pending);
    assert.equal(errors.length, 1);
    assert.equal(state.offers.length, 2);
    assert.ok(ids(state).includes(id(7)));
    assert.notEqual(store.get('cj.accountUser'), ME);
  });

  test('after a failed upload, retrying keeps them beside the account offers', async () => {
    const { account, state, fake, data } = first();
    fake.failNext = true;
    await account.connect();
    await account.uploadPending();
    assert.equal(state.offers.length, 3);
    assert.deepEqual(data.offers.map((o) => o.id).sort(), ids(state).sort());
    assert.deepEqual(account.pendingOffers(), []);
  });

  test('after a failed upload, discarding them takes the account copy', async () => {
    const { account, state, fake } = first();
    fake.failNext = true;
    await account.connect();
    account.discardPending();
    assert.deepEqual(ids(state), [id(1)]);
  });

  test('offers already in the account are not extra', async () => {
    const { account } = setUp({
      synced: null,
      localOffers: [{ ...makeOffer(), id: id(1) }],
      tables: accountTables(accountRow(1)),
    });
    assert.deepEqual((await account.connect()).pending, []);
  });

  test('a browser that synced before drops offers the account lost', async () => {
    const { account, state } = setUp({ localOffers: local(), tables: accountTables(accountRow(1)) });
    await account.connect();
    assert.deepEqual(ids(state), [id(1)]);
  });
});

describe('saving changes', () => {
  async function connected() {
    const tables = { ...accountTables(accountRow(1), accountRow(2)), settings: [{ user_id: ME, cfg: {} }] };
    const context = setUp({ tables });
    await context.account.connect();
    return context;
  }

  test('only the changed offer is written, with schema_version', async () => {
    const { account, state, calls } = await connected();
    state.offers[1].terms.payAmount = 1200;
    state.offers[1].cmp = false;
    await account.flush();
    assert.equal(calls.filter((c) => c.table === 'offers').length, 1);
    const [offers, mine] = calls;
    assert.deepEqual([offers.table, offers.op, mine.table, mine.op], ['offers', 'upsert', 'offer_mine', 'upsert']);
    assert.equal(offers.rows.length, 1);
    assert.equal(offers.rows[0].id, id(2));
    assert.equal(offers.rows[0].user_id, ME);
    assert.equal(offers.rows[0].schema_version, SCHEMA_VERSION);
    assert.equal(offers.rows[0].terms.payAmount, 1200);
    assert.equal(mine.rows[0].cmp, false);
    assert.equal('mine' in offers.rows[0], false);
    assert.equal('terms' in mine.rows[0], false);
  });

  test('an offer whose shared terms still hold offerOnly is rewritten without it', async () => {
    const old = accountRow(2, { offerOnly: true });
    delete old[1].mine.offerOnly; // rows from before the move have no offerOnly in `mine`
    const tables = accountTables(accountRow(1), old);
    const { account, state, calls } = setUp({ tables });
    await account.connect();
    assert.equal(state.offers[1].mine.offerOnly, true);
    assert.equal('offerOnly' in state.offers[1].terms, false);
    await account.flush();
    const [offers, mine] = calls;
    assert.deepEqual(
      offers.rows.map((r) => r.id),
      [id(2)],
    );
    assert.equal('offerOnly' in offers.rows[0].terms, false);
    assert.equal(mine.rows[0].mine.offerOnly, true);
    calls.length = 0;
    await account.flush();
    assert.deepEqual(calls, []);
  });

  test('nothing is written when nothing changed', async () => {
    const { account, calls } = await connected();
    await account.flush();
    assert.deepEqual(calls, []);
  });

  test('a batch of changes is written once, after the pause', async () => {
    const { account, state, calls } = await connected();
    state.offers[0].mine.name = 'a';
    account.changed();
    state.offers[0].mine.name = 'ab';
    account.changed();
    assert.deepEqual(calls, []);
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(calls.filter((c) => c.table === 'offers').length, 1);
  });

  test('settings are written when they change', async () => {
    const { account, state, calls } = await connected();
    state.config = { ...state.config, others: 3000 };
    await account.flush();
    assert.deepEqual(
      calls.map((c) => c.table),
      ['settings'],
    );
    assert.equal(calls[0].rows[0].cfg.others, 3000);
    assert.equal(calls[0].rows[0].user_id, ME);
  });

  test('deleting an offer deletes its row', async () => {
    const { account, state, calls, data } = await connected();
    state.offers.splice(0, 1);
    await account.flush();
    assert.deepEqual(calls, [{ table: 'offers', op: 'delete', ids: [id(1)] }]);
    assert.deepEqual(
      data.offers.map((o) => o.id),
      [id(2)],
    );
  });

  test('a new offer is written; one with an old id gets a uuid first', async () => {
    const { account, state, calls } = await connected();
    state.offers.push({ ...makeOffer(), id: 'o9zz' });
    state.activeId = 'o9zz';
    await account.flush();
    const written = calls[0].rows[0].id;
    assert.match(written, UUID);
    assert.equal(state.activeId, written);
    assert.ok(ids(state).includes(written));
  });

  test('a background save reports saving, then saved', async () => {
    const { account, state, statuses } = await connected();
    state.offers[0].terms.payAmount = 5;
    account.changed();
    assert.deepEqual(statuses, ['saving']);
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.deepEqual(statuses, ['saving', 'saved']);
  });

  test('a failed write is reported and retried with the next change', async () => {
    const { account, state, calls, errors, statuses, fake } = await connected();
    state.offers[0].terms.payAmount = 5;
    fake.failNext = true;
    account.changed();
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(errors.length, 1);
    assert.deepEqual(statuses, ['saving', 'error']);
    assert.deepEqual(calls, []);
    await account.flush();
    assert.equal(calls[0].rows[0].id, id(1));
  });

  test('after sign-out nothing is written', async () => {
    const { account, state, calls, fake } = await connected();
    await account.signOut();
    state.offers[0].terms.payAmount = 9;
    account.changed();
    await account.flush();
    assert.deepEqual(calls, []);
    assert.equal(fake.signedOut, true);
    assert.equal(account.currentUser(), null);
  });
});

describe('signing out', () => {
  test('saves what is pending, clears the browser copy and starts like a first visit, writing nothing after', async () => {
    const { account, state, store, calls, replaced } = setUp({ tables: accountTables(accountRow(1)) });
    await account.connect();
    store.set('cj.ofertas2', 'x');
    state.config.inKind = false;
    calls.length = 0;
    await account.signOut();
    assert.deepEqual(
      calls.map((c) => c.table),
      ['settings'],
    );
    calls.length = 0;
    assert.equal(state.offers.length, 1);
    assert.equal(state.placeholderId, state.offers[0].id);
    assert.equal(state.firstRun, true);
    assert.equal(state.config.inKind, DEF_CFG.inKind);
    assert.equal(store.get('cj.ofertas2'), null);
    assert.equal(store.get('cj.accountUser'), null);
    assert.equal(replaced.length, 2); // connect, then the sign-out
    account.changed();
    await account.flush();
    assert.deepEqual(calls, []);
  });

  test("the next user does not receive the first one's offers", async () => {
    const first = setUp({ tables: accountTables(accountRow(1)) });
    await first.account.connect();
    first.state.offers.push({ ...makeOffer(), id: id(5) }); // not yet in the account: saved by the sign-out
    await first.account.signOut();
    assert.ok(first.data.offers.some((o) => o.id === id(5)));
    assert.ok(!ids(first.state).includes(id(5)));
    const second = fakeClient({ session: { user: { id: OTHER } } });
    const account = createAccount({
      client: second.client,
      state: first.state,
      store: first.store,
      persist: () => {},
      debounceMs: 5,
    });
    const result = await account.connect();
    assert.deepEqual(result.pending, []);
    assert.deepEqual(
      second.calls.filter((c) => c.op !== 'select'),
      [],
    );
    assert.deepEqual(second.data.offers, []);
  });
});

describe('signing out, when it cannot', () => {
  test('a failed save keeps the session, the offers and the saving', async () => {
    const { account, state, fake, calls, statuses, errors } = setUp({ tables: accountTables(accountRow(1)) });
    await account.connect();
    state.offers[0].terms.payAmount = 7;
    fake.failNext = true;
    await assert.rejects(account.signOut(), /network/);
    assert.equal(fake.signedOut, false);
    assert.equal(account.currentUser()?.id, ME);
    assert.equal(state.offers[0].terms.payAmount, 7);
    assert.equal(statuses.at(-1), 'error');
    assert.deepEqual(errors, []);
    await account.flush(); // still syncing
    assert.equal(calls.find((c) => c.table === 'offers').rows[0].terms.payAmount, 7);
  });

  test('a failed sign-out leaves the page as it was, still saving', async () => {
    const { account, state, fake, client, calls, store } = setUp({ tables: accountTables(accountRow(1)) });
    await account.connect();
    const real = client.auth.signOut;
    client.auth.signOut = async () => ({ error: new Error('offline') });
    await assert.rejects(account.signOut(), /offline/);
    client.auth.signOut = real;
    assert.equal(account.currentUser()?.id, ME);
    assert.equal(store.get('cj.accountUser'), ME);
    assert.equal(ids(state)[0], id(1));
    assert.equal(fake.signedOut, false);
    state.offers[0].terms.payAmount = 3;
    await account.flush();
    assert.equal(calls.filter((c) => c.table === 'offers').length, 1);
  });
});

describe('changes that have not reached the account', () => {
  /** A second page load on the same browser: same storage and offers, a client that may differ. */
  const reload = (first, tables) => {
    const next = fakeClient({ tables });
    const state = JSON.parse(JSON.stringify(first.state));
    const account = createAccount({
      client: next.client,
      state,
      store: {
        get: (key, fallback) => first.store.get(key) ?? fallback,
        set: (key, value) => first.store.set(key, value),
      },
      persist: () => {},
      debounceMs: 5,
    });
    return { account, state, ...next };
  };

  test('an edit made during a write is written next time', async () => {
    const { account, state, client, calls } = setUp({ tables: accountTables(accountRow(1)) });
    await account.connect();
    let release = () => {};
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const from = client.from;
    client.from = (table) => {
      const query = from(table);
      if (table !== 'offer_mine') return query;
      const run = query.run.bind(query);
      query.run = () => gate.then(run);
      return query;
    };
    state.offers[0].terms.payAmount = 1;
    const writing = account.flush();
    await new Promise((resolve) => setTimeout(resolve, 5));
    state.offers[0].terms.payAmount = 2; // while the request is out
    release();
    await writing;
    assert.equal(calls[0].rows[0].terms.payAmount, 1);
    await account.flush();
    assert.equal(calls.filter((c) => c.table === 'offers').at(-1).rows[0].terms.payAmount, 2);
  });

  test('offline edits survive a reload and reach the account', async () => {
    const first = setUp({ tables: accountTables(accountRow(1), accountRow(2)) });
    await first.account.connect();
    first.state.offers[0].terms.payAmount = 11;
    first.state.offers.push({ ...makeOffer(), id: id(3) });
    first.state.config = { ...first.state.config, others: 500 };
    first.fake.failNext = true;
    first.account.changed();
    await new Promise((resolve) => setTimeout(resolve, 30)); // the save fails
    const accountNow = {
      offers: structuredClone(first.data.offers),
      offer_mine: structuredClone(first.data.offer_mine),
      settings: [{ user_id: ME, cfg: {} }],
    };
    const second = reload(first, accountNow);
    await second.account.connect();
    assert.equal(second.state.offers.find((o) => o.id === id(1)).terms.payAmount, 11);
    assert.deepEqual(ids(second.state).sort(), [id(1), id(2), id(3)]);
    assert.equal(second.state.config.others, 500);
    assert.deepEqual(second.data.offers.map((o) => o.id).sort(), [id(1), id(2), id(3)]);
    assert.equal(second.data.offers.find((o) => o.id === id(1)).terms.payAmount, 11);
    assert.equal(second.data.settings[0].cfg.others, 500);
    assert.equal(first.store.get('cj.accountUnsynced'), null);
  });

  test('a deletion made offline is applied to the account', async () => {
    const first = setUp({ tables: accountTables(accountRow(1), accountRow(2)) });
    await first.account.connect();
    first.state.offers.splice(0, 1);
    first.fake.failNext = true;
    first.account.changed();
    await new Promise((resolve) => setTimeout(resolve, 30));
    const second = reload(first, {
      offers: structuredClone(first.data.offers),
      offer_mine: structuredClone(first.data.offer_mine),
    });
    await second.account.connect();
    assert.deepEqual(ids(second.state), [id(2)]);
    assert.deepEqual(
      second.data.offers.map((o) => o.id),
      [id(2)],
    );
  });

  test('an account change made elsewhere is kept where nothing was edited here', async () => {
    const first = setUp({ tables: accountTables(accountRow(1), accountRow(2)) });
    await first.account.connect();
    first.state.offers[0].terms.payAmount = 11;
    first.fake.failNext = true;
    first.account.changed();
    await new Promise((resolve) => setTimeout(resolve, 30));
    const elsewhere = accountTables(accountRow(1), accountRow(2, { payAmount: 99 }));
    const second = reload(first, elsewhere);
    await second.account.connect();
    assert.equal(second.state.offers.find((o) => o.id === id(2)).terms.payAmount, 99);
    assert.equal(second.state.offers.find((o) => o.id === id(1)).terms.payAmount, 11);
  });
});

describe('other users and the profile', () => {
  const tables = () => ({
    ...accountTables(accountRow(1)),
    profiles: [
      { user_id: ME, name: 'Yo', email: 'yo@example.com', phone: null, sharing: true },
      { user_id: OTHER, name: 'Ana', email: 'ana@example.com', phone: '600', sharing: true },
    ],
  });

  test('shared offers come as { id, terms } with the sharer', async () => {
    const t = tables();
    t.offers.push({ id: id(5), user_id: OTHER, terms: { payAmount: 80 } });
    t.offer_mine.push({ offer_id: id(5), mine: { name: 'privado' }, cmp: true });
    const { account } = setUp({ tables: t });
    await account.connect();
    const shared = await account.sharedOffers();
    assert.equal(shared.length, 1);
    assert.deepEqual(shared[0].offer, { id: id(5), terms: { payAmount: 80 } });
    assert.equal('mine' in shared[0].offer, false);
    assert.deepEqual(shared[0].sharer, { user_id: OTHER, name: 'Ana', email: 'ana@example.com', phone: '600' });
  });

  test('reads and updates only the allowed profile fields', async () => {
    const { account, data } = setUp({ tables: tables() });
    await account.connect();
    assert.equal((await account.profile()).name, 'Yo');
    const updated = await account.updateProfile({ phone: '611', sharing: false, user_id: OTHER, junk: 1 });
    assert.equal(updated.phone, '611');
    const mine = data.profiles.find((p) => p.user_id === ME);
    assert.equal(mine.sharing, false);
    assert.equal('junk' in mine, false);
    assert.equal(data.profiles.find((p) => p.user_id === OTHER).phone, '600');
  });

  test('deleting the account calls the server function and signs out', async () => {
    const { account, fake } = setUp({ tables: tables() });
    await account.connect();
    await account.deleteAccount();
    assert.deepEqual(fake.rpc, ['delete_my_account']);
    assert.equal(fake.signedOut, true);
  });
});
