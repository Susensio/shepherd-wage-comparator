// The fake supabase-js client shared by the account specs: no real project is needed.
//
// The seam, with no test code in the page: `src/storage/account-config.js` is served with a project set (a route),
// and `window.supabase` is defined before the page starts, so `loadSupabase` returns the fake instead of loading the
// bundle. Without that route the config is null and the account stays off.

/** Serves a configured project in place of the null one. */
export const withProject = (page) =>
  page.route('**/src/storage/account-config.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: "export const ACCOUNT_CONFIG = { url: 'https://fake.test', anonKey: 'fake' };",
    }),
  );

/**
 * Runs in the page before the app: a saved session (unless `signedOut`), the tables, and `window.supabase`. The
 * client has only what the account layer calls, over `window.fake.data`; `fake` also records oauth, rpc and sign-outs.
 */
export function installFake({ signedOut, tables, localOffers, failProfile }) {
  if (!signedOut) localStorage.setItem('cj.session', '{}');
  if (localOffers) localStorage.setItem('cj.ofertas2', JSON.stringify(localOffers));
  const data = { offers: [], offer_mine: [], settings: [], profiles: [], ...tables };
  const fake = { data, oauth: null, rpc: [], signedOut: false, sharedReads: 0 };
  window.fake = fake;
  const keyOf = { offer_mine: 'offer_id', offers: 'id', settings: 'user_id', profiles: 'user_id' };
  const test = { eq: (a, b) => a === b, neq: (a, b) => a !== b, in: (a, list) => list.includes(a) };

  class Query {
    op = 'select';
    filters = [];
    one = false;
    constructor(table) {
      this.table = table;
    }
    select() {
      return this;
    }
    upsert(rows) {
      this.op = 'upsert';
      this.payload = Array.isArray(rows) ? rows : [rows];
      return this;
    }
    update(payload) {
      this.op = 'update';
      this.payload = payload;
      return this;
    }
    delete() {
      this.op = 'delete';
      return this;
    }
    single() {
      this.one = true;
      return this;
    }
    maybeSingle() {
      return this.single();
    }
    // biome-ignore lint/suspicious/noThenProperty: awaiting a query runs it, as in supabase-js
    then(resolve, reject) {
      return Promise.resolve(this.run()).then(resolve, reject);
    }
    run() {
      const { table, op } = this;
      if (op === 'select' && table === 'offers' && this.filters.some(([kind]) => kind === 'neq')) fake.sharedReads++;
      const rows = data[table].filter((row) => this.filters.every(([kind, col, value]) => test[kind](row[col], value)));
      if (op === 'update' && failProfile) return { data: null, error: new Error('network') };
      if (op === 'upsert')
        for (const row of this.payload) {
          const at = data[table].findIndex((r) => r[keyOf[table]] === row[keyOf[table]]);
          if (at < 0) data[table].push({ ...row });
          else Object.assign(data[table][at], row);
        }
      if (op === 'delete') data[table] = data[table].filter((r) => !rows.includes(r));
      if (op === 'update') for (const row of rows) Object.assign(row, this.payload);
      return { data: this.one ? (rows[0] ?? null) : rows, error: null };
    }
  }
  for (const kind of ['eq', 'neq', 'in'])
    Query.prototype[kind] = function (column, value) {
      this.filters.push([kind, column, value]);
      return this;
    };

  const client = {
    from: (table) => new Query(table),
    rpc: async (name) => {
      fake.rpc.push(name);
      return { data: null, error: null };
    },
    auth: {
      getSession: async () => ({
        data: {
          session: signedOut
            ? null
            : { user: { id: '00000000-0000-0000-0000-00000000000a', email: 'ana@example.com' } },
        },
        error: null,
      }),
      signInWithOAuth: async (args) => {
        fake.oauth = args;
        return { data: {}, error: null };
      },
      signOut: async () => {
        fake.signedOut = true;
        return { error: null };
      },
    },
  };
  window.supabase = { createClient: () => client };
}
