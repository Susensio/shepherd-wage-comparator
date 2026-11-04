// A fake supabase-js client over in-memory tables, shared by the account unit tests.

export const ME = '00000000-0000-0000-0000-00000000000a';

/**
 * Only the supabase-js calls the account uses, over in-memory tables. `calls` records every write as
 * `{ table, op, rows | ids }`; `fake.failNext` makes the next write fail once; `fake.selectErrors[table]` makes reads of a table fail.
 */
export function fakeClient({ session = { user: { id: ME } }, tables = {} } = {}) {
  const data = {
    offers: [],
    offer_mine: [],
    settings: [],
    profiles: [],
    app_meta: [{ min_page_version: 1 }],
    ...tables,
  };
  const calls = [];
  const fake = {
    selectErrors: {},
    failNext: false,
    signedOut: false,
    oauth: null,
    idToken: null,
    otp: null,
    verified: null,
    rpc: [],
  };
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
      if (op === 'select' && fake.selectErrors[table]) return { data: null, error: fake.selectErrors[table] };
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
