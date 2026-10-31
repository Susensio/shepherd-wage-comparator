// The fake supabase-js client shared by the account specs: no real project is needed.
//
// The seam, with no test code in the page: `src/storage/account-config.js` is served with a project set (a route),
// and `window.supabase` is defined before the page starts, so `loadSupabase` returns the fake instead of loading the
// bundle. `withoutProject` serves a null config instead, so a test of the account being off does not depend on the
// real project in the file. Google's script is never reached (the tests are offline), so its plain fallback button
// shows, unless `installFake` gets `google` and defines a fake `window.google` first.

/** Serves `account-config.js` with these values. */
const serveConfig = (page, config) =>
  page.route('**/src/storage/account-config.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `export const ACCOUNT_CONFIG = ${JSON.stringify(config)};`,
    }),
  );

/** Serves a fake project in place of the real one. */
export const withProject = (page) =>
  serveConfig(page, {
    url: 'https://fake.test',
    anonKey: 'fake',
    googleClientId: 'fake.apps.googleusercontent.com',
    emailSignIn: true,
  });

/** Serves no project: every account feature off. */
export const withoutProject = (page) => serveConfig(page, { url: null, anonKey: null, googleClientId: null });

/**
 * Runs in the page before the app: a saved session (unless `signedOut`), the tables, and `window.supabase`. The
 * client has only what the account layer calls, over `window.fake.data`; `fake` also records oauth, the ID token, the
 * emailed code (and every one sent, in `otps`), rpc and sign-outs. `failUpload` fails the first offer upload; `holdSession`
 * keeps the first `getSession` pending until the test calls `fake.releaseSession()`; `google` adds a fake Google script whose
 * button hands over a token, and which records its nonce, the theme of each button drawn and how often the account chooser was opened.
 */
export function installFake({ signedOut, tables, localOffers, failProfile, failUpload, google, holdSession }) {
  if (!signedOut) localStorage.setItem('cj.session', '{}');
  if (localOffers) localStorage.setItem('cj.ofertas2', JSON.stringify(localOffers));
  const data = { offers: [], offer_mine: [], settings: [], profiles: [], ...tables };
  const fake = {
    data,
    oauth: null,
    idToken: null,
    otp: null,
    otps: [],
    rpc: [],
    signedOut: false,
    sharedReads: 0,
    google: { nonce: null, prompts: 0, themes: [] },
  };
  let session = signedOut ? null : { user: { id: '00000000-0000-0000-0000-00000000000a', email: 'ana@example.com' } };
  const signIn = () => {
    session = { user: { id: '00000000-0000-0000-0000-00000000000a', email: 'ana@example.com' } };
    return { data: { session }, error: null };
  };
  let uploadFails = !!failUpload;
  let held = holdSession
    ? new Promise((resolve) => {
        fake.releaseSession = resolve;
      })
    : null;
  if (google) {
    let callback = () => {};
    window.google = {
      accounts: {
        id: {
          initialize(options) {
            fake.google.nonce = options.nonce;
            callback = options.callback;
          },
          renderButton(slot, options) {
            fake.google.themes.push(options.theme);
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Google (falso)';
            button.onclick = () => callback({ credential: 'google-jwt' });
            slot.append(button);
          },
          prompt() {
            fake.google.prompts++;
          },
          disableAutoSelect() {},
        },
      },
    };
  }
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
      if (op === 'upsert' && table === 'offers' && uploadFails) {
        uploadFails = false;
        return { data: null, error: new Error('network') };
      }
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
      getSession: async () => {
        await held;
        held = null;
        return { data: { session }, error: null };
      },
      signInWithIdToken: async (args) => {
        fake.idToken = args;
        return signIn();
      },
      signInWithOtp: async (args) => {
        fake.otp = args;
        fake.otps.push(args);
        return { data: {}, error: null };
      },
      verifyOtp: async ({ token }) =>
        token === '123456' ? signIn() : { data: {}, error: new Error('Token has expired or is invalid') },
      signInWithOAuth: async (args) => {
        fake.oauth = args;
        return { data: {}, error: null };
      },
      signOut: async () => {
        fake.signedOut = true;
        session = null;
        return { error: null };
      },
    },
  };
  window.supabase = { createClient: () => client };
}
