// Row-level security of supabase/migrations/ (applied in order) against Postgres in WASM, with a stub of what Supabase provides.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { before, describe, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const MIGRATIONS_DIR = new URL('../../supabase/migrations/', import.meta.url);
const FILES = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith('.sql'))
  .sort();
const MIGRATIONS = FILES.map((file) => readFileSync(new URL(file, MIGRATIONS_DIR), 'utf8'));
/** The SQL of the migrations before `name`, and of `name` itself. */
const upTo = (name) => {
  const at = FILES.findIndex((file) => file.includes(name));
  return { before: MIGRATIONS.slice(0, at), it: MIGRATIONS[at] };
};

async function migrate() {
  for (const sql of MIGRATIONS) await db.exec(sql);
}

const STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`;

const ID = {
  ana: '00000000-0000-0000-0000-00000000000a', // sharing, one offer
  ben: '00000000-0000-0000-0000-00000000000b', // sharing, one offer
  cai: '00000000-0000-0000-0000-00000000000c', // sharing, no offers
  dan: '00000000-0000-0000-0000-00000000000d', // not sharing, one offer
};
const OFFER = {
  ana: '10000000-0000-0000-0000-00000000000a',
  ben: '10000000-0000-0000-0000-00000000000b',
  dan: '10000000-0000-0000-0000-00000000000d',
};

/** @type {PGlite} */
let db;

/** Runs sql as a user key, 'anon', or the superuser (null). */
async function as(who, sql, params) {
  if (who === null) return db.query(sql, params);
  await db.query(`set role ${who === 'anon' ? 'anon' : 'authenticated'}`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [who === 'anon' ? '' : ID[who]]);
  try {
    return await db.query(sql, params);
  } finally {
    await db.query('reset role');
  }
}

/** Sorted values of the first column. */
async function column(who, sql) {
  const { rows } = await as(who, sql);
  return rows.map((row) => Object.values(row)[0]).sort();
}

before(async () => {
  db = new PGlite();
  await db.exec(STUB);
  await migrate();
  for (const [name, id] of Object.entries(ID)) {
    await db.query('insert into auth.users values ($1, $2, $3)', [
      id,
      `${name}@example.com`,
      JSON.stringify({ full_name: name }),
    ]);
  }
  await db.exec(`
    update profiles set sharing = true, phone = '600' where user_id in ('${ID.ana}', '${ID.ben}', '${ID.cai}');
    insert into offers (id, user_id, terms, schema_version) values
      ('${OFFER.ana}', '${ID.ana}', '{}', 5),
      ('${OFFER.ben}', '${ID.ben}', '{}', 5),
      ('${OFFER.dan}', '${ID.dan}', '{}', 5);
    insert into offer_mine values ('${OFFER.ana}', '{"kmHome": 1}'), ('${OFFER.ben}', '{"kmHome": 2}');
    insert into settings (user_id, cfg) values ('${ID.ana}', '{}'), ('${ID.ben}', '{}');
  `);
});

describe('schema', () => {
  test('signup trigger fills the profile from the metadata', async () => {
    const { rows } = await as(null, 'select name, email from profiles where user_id = $1', [ID.ana]);
    assert.deepEqual(rows, [{ name: 'ana', email: 'ana@example.com' }]);
  });

  test('loading it twice is harmless', async () => {
    await migrate();
  });
});

describe('owner', () => {
  test('reads and updates own rows', async () => {
    assert.deepEqual(await column('dan', 'select id from offers'), [OFFER.dan]);
    await as('dan', `update offers set schema_version = 2 where id = '${OFFER.dan}'`);
    assert.deepEqual(await column('dan', 'select schema_version from offers'), [2]);
  });

  test('inserts and deletes own offer and its mine', async () => {
    const { rows } = await as(
      'dan',
      `insert into offers (user_id, terms, schema_version) values ('${ID.dan}', '{}', 1) returning id`,
    );
    await as('dan', "insert into offer_mine values ($1, '{}')", [rows[0].id]);
    assert.equal((await as('dan', 'select * from offer_mine')).rows.length, 1);
    await as('dan', 'delete from offers where id = $1', [rows[0].id]);
    assert.equal((await as('dan', 'select * from offer_mine')).rows.length, 0);
  });

  test('reads own settings and mine', async () => {
    assert.deepEqual(await column('ana', 'select user_id from settings'), [ID.ana]);
    assert.deepEqual(await column('ana', 'select offer_id from offer_mine'), [OFFER.ana]);
  });
});

describe('readers', () => {
  test('a non-sharer sees only their own rows', async () => {
    assert.deepEqual(await column('dan', 'select id from offers'), [OFFER.dan]);
    assert.deepEqual(await column('dan', 'select user_id from profiles'), [ID.dan]);
  });

  test('a sharer without offers sees only their own rows', async () => {
    assert.deepEqual(await column('cai', 'select id from offers'), []);
    assert.deepEqual(await column('cai', 'select user_id from profiles'), [ID.cai]);
  });

  test('a sharer with an offer sees sharers only', async () => {
    assert.deepEqual(await column('ana', 'select id from offers'), [OFFER.ana, OFFER.ben]);
    assert.deepEqual(await column('ana', 'select user_id from profiles'), [ID.ana, ID.ben, ID.cai]);
  });

  test('switching sharing off hides the offer', async () => {
    await as('ben', `update profiles set sharing = false where user_id = '${ID.ben}'`);
    try {
      assert.deepEqual(await column('ana', 'select id from offers'), [OFFER.ana]);
      assert.deepEqual(await column('ben', 'select id from offers'), [OFFER.ben]);
    } finally {
      await as('ben', `update profiles set sharing = true where user_id = '${ID.ben}'`);
    }
  });

  test('never see settings or mine of others', async () => {
    assert.deepEqual(await column('ana', 'select user_id from settings'), [ID.ana]);
    assert.deepEqual(await column('ana', 'select offer_id from offer_mine'), [OFFER.ana]);
  });

  test('cannot write what they can read', async () => {
    await as('ana', `update offers set schema_version = 9 where id = '${OFFER.ben}'`);
    await as('ana', `delete from offers where id = '${OFFER.ben}'`);
    await as('ana', `update profiles set phone = 'x' where user_id = '${ID.ben}'`);
    assert.deepEqual(await column(null, `select schema_version from offers where id = '${OFFER.ben}'`), [5]);
    assert.deepEqual(await column(null, `select phone from profiles where user_id = '${ID.ben}'`), ['600']);
  });
});

describe('anon', () => {
  for (const table of ['profiles', 'settings', 'offers', 'offer_mine']) {
    test(`has no access to ${table}`, async () => {
      await assert.rejects(as('anon', `select * from ${table}`), /permission denied/);
      await assert.rejects(as('anon', `delete from ${table}`), /permission denied/);
    });
  }

  test('cannot call can_read', async () => {
    await assert.rejects(as('anon', 'select can_read()'), /permission denied/);
  });
});

describe('min_page_version', () => {
  test('anon and every signed-in user read the one row', async () => {
    for (const who of ['anon', 'ana', 'dan']) {
      assert.deepEqual(await column(who, 'select min_page_version from app_meta'), [4], who);
    }
  });

  test('nobody writes it through the API, not even to look at it', async () => {
    for (const who of ['anon', 'ana']) {
      await assert.rejects(as(who, 'update app_meta set min_page_version = 99'), /permission denied/, who);
      await assert.rejects(
        as(who, 'insert into app_meta (singleton, min_page_version) values (false, 99)'),
        /permission denied/,
        who,
      );
      await assert.rejects(as(who, 'delete from app_meta'), /permission denied/, who);
    }
    assert.deepEqual(await column(null, 'select min_page_version from app_meta'), [4]);
  });

  test('it holds a single row, and loading the migrations again keeps its value', async () => {
    await assert.rejects(as(null, 'insert into app_meta (singleton, min_page_version) values (false, 2)'), /check/);
    await as(null, 'update app_meta set min_page_version = 5');
    await migrate();
    assert.deepEqual(await column('anon', 'select min_page_version from app_meta'), [5]);
    await as(null, 'update app_meta set min_page_version = 4');
  });
});

describe('writes for someone else', () => {
  test('insert with another user_id is refused', async () => {
    await assert.rejects(
      as('ana', `insert into offers (user_id, terms, schema_version) values ('${ID.ben}', '{}', 1)`),
      /row-level security/,
    );
    await assert.rejects(
      as('ana', `insert into settings (user_id, cfg) values ('${ID.cai}', '{}')`),
      /row-level security/,
    );
    await assert.rejects(as('ana', `insert into profiles (user_id) values ('${ID.cai}')`), /row-level security/);
  });

  test('update cannot hand a row to another user', async () => {
    await assert.rejects(
      as('ana', `update offers set user_id = '${ID.ben}' where id = '${OFFER.ana}'`),
      /row-level security/,
    );
  });

  test('offer_mine of someone else is refused', async () => {
    await assert.rejects(as('ana', `insert into offer_mine values ('${OFFER.dan}', '{}')`), /row-level security/);
    const { affectedRows } = await as('ana', `update offer_mine set mine = '{}' where offer_id = '${OFFER.ben}'`);
    assert.equal(affectedRows, 0);
  });
});

describe('delete_my_account', () => {
  test('anon cannot call it', async () => {
    await assert.rejects(as('anon', 'select delete_my_account()'), /permission denied/);
  });

  test('a user removes only their own account and rows', async () => {
    await as('dan', 'select delete_my_account()');
    assert.deepEqual(await column(null, `select id from auth.users where id = '${ID.dan}'`), []);
    assert.deepEqual(await column(null, `select id from offers where user_id = '${ID.dan}'`), []);
    assert.deepEqual(await column(null, `select user_id from profiles where user_id = '${ID.dan}'`), []);
    assert.deepEqual(await column(null, `select id from auth.users where id = '${ID.ana}'`), [ID.ana]);
    assert.deepEqual(await column(null, `select id from offers where id = '${OFFER.ana}'`), [OFFER.ana]);
  });
});

describe('account deletion', () => {
  test('removes every row of the user', async () => {
    await as(null, 'delete from auth.users where id = $1', [ID.ben]);
    assert.deepEqual(await column(null, `select user_id from profiles where user_id = '${ID.ben}'`), []);
    assert.deepEqual(await column(null, `select user_id from settings where user_id = '${ID.ben}'`), []);
    assert.deepEqual(await column(null, `select id from offers where user_id = '${ID.ben}'`), []);
    assert.deepEqual(await column(null, `select offer_id from offer_mine where offer_id = '${OFFER.ben}'`), []);
  });
});

describe('schema version 3: offerOnly and the village move to the shared terms (ADR-0028)', () => {
  test('every row is rewritten, `mine` wins over a stale copy in `terms`, and old pages stop writing', async () => {
    const fresh = new PGlite();
    await fresh.exec(STUB);
    const { before: earlier, it } = upTo('offer_only_and_village_in_terms');
    for (const sql of earlier) await fresh.exec(sql);
    await fresh.query('insert into auth.users values ($1, $2, $3)', [ID.ana, 'ana@example.com', '{}']);
    const offer = (n) => `20000000-0000-0000-0000-00000000000${n}`;
    await fresh.exec(`
      insert into offers (id, user_id, terms, schema_version) values
        ('${offer(1)}', '${ID.ana}', '{"payAmount": 1785}', 2),
        ('${offer(2)}', '${ID.ana}', '{"payAmount": 50, "offerOnly": false}', 2),
        ('${offer(3)}', '${ID.ana}', '{"offerOnly": true}', 2),
        ('${offer(4)}', '${ID.ana}', '{"offerOnly": true, "place": "Ya"}', 3);
      insert into offer_mine (offer_id, mine) values
        ('${offer(1)}', '{"name": "A", "offerOnly": true, "place": "Sarvisé", "kmHome": 3}'),
        ('${offer(2)}', '{"name": "B", "offerOnly": true}'),
        ('${offer(4)}', '{"name": "D"}');
    `);
    await fresh.exec(it);
    await fresh.exec(it); // twice is harmless
    const { rows } = await fresh.query(
      'select o.id, o.terms, o.schema_version, m.mine from offers o left join offer_mine m on m.offer_id = o.id order by o.id',
    );
    assert.deepEqual(
      rows.map((row) => [row.terms, row.schema_version, row.mine]),
      [
        [{ payAmount: 1785, offerOnly: true, place: 'Sarvisé' }, 3, { name: 'A', kmHome: 3 }],
        [{ payAmount: 50, offerOnly: true, place: '' }, 3, { name: 'B' }],
        [{ offerOnly: true, place: '' }, 3, null],
        [{ offerOnly: true, place: 'Ya' }, 3, { name: 'D' }],
      ],
    );
    const { rows: meta } = await fresh.query('select min_page_version from app_meta');
    assert.deepEqual(meta, [{ min_page_version: 2 }]);
    await fresh.close();
  });
});

describe('schema version 4: the self-employed contract (ADR-0029)', () => {
  test('rows get vatIncluded at its default and version 4, a value already there is kept, old pages stop writing', async () => {
    const fresh = new PGlite();
    await fresh.exec(STUB);
    const { before: earlier, it } = upTo('self_employed');
    for (const sql of earlier) await fresh.exec(sql);
    await fresh.query('insert into auth.users values ($1, $2, $3)', [ID.ana, 'ana@example.com', '{}']);
    const offer = (n) => `30000000-0000-0000-0000-00000000000${n}`;
    await fresh.exec(`
      insert into offers (id, user_id, terms, schema_version) values
        ('${offer(1)}', '${ID.ana}', '{"payAmount": 1785}', 3),
        ('${offer(2)}', '${ID.ana}', '{"contract": "selfEmployed", "vatIncluded": true}', 4);
    `);
    await fresh.exec(it);
    await fresh.exec(it); // twice is harmless
    const { rows } = await fresh.query('select terms, schema_version from offers order by id');
    assert.deepEqual(
      rows.map((row) => [row.terms, row.schema_version]),
      [
        [{ payAmount: 1785, vatIncluded: false }, 4],
        [{ contract: 'selfEmployed', vatIncluded: true }, 4],
      ],
    );
    const { rows: meta } = await fresh.query('select min_page_version from app_meta');
    assert.deepEqual(meta, [{ min_page_version: 3 }]);
    await fresh.close();
  });
});

describe('schema version 5: mine.record (ADR-0032)', () => {
  test('every mine gets an empty record, one already there is kept, rows are stamped 5, old pages stop writing', async () => {
    const fresh = new PGlite();
    await fresh.exec(STUB);
    const { before: earlier, it } = upTo('record_in_mine');
    for (const sql of earlier) await fresh.exec(sql);
    await fresh.query('insert into auth.users values ($1, $2, $3)', [ID.ana, 'ana@example.com', '{}']);
    const offer = (n) => `40000000-0000-0000-0000-00000000000${n}`;
    const kept = '{"months": {"2026-06": {"closed": true, "days": {"01": "work"}}}, "payments": []}';
    await fresh.exec(`
      insert into offers (id, user_id, terms, schema_version) values
        ('${offer(1)}', '${ID.ana}', '{"payAmount": 1785}', 4),
        ('${offer(2)}', '${ID.ana}', '{}', 5),
        ('${offer(3)}', '${ID.ana}', '{}', 5);
      insert into offer_mine (offer_id, mine) values
        ('${offer(1)}', '{"name": "A", "kmHome": 3}'),
        ('${offer(3)}', '{"name": "C", "record": ${kept}}');
    `);
    await fresh.exec(it);
    await fresh.exec(it); // twice is harmless
    const { rows } = await fresh.query(
      'select o.terms, o.schema_version, m.mine from offers o left join offer_mine m on m.offer_id = o.id order by o.id',
    );
    assert.deepEqual(
      rows.map((row) => [row.terms, row.schema_version, row.mine]),
      [
        [{ payAmount: 1785 }, 5, { name: 'A', kmHome: 3, record: { months: {}, payments: [] } }],
        [{}, 5, null], // no offer_mine row: the page completes it on load
        [{}, 5, { name: 'C', record: JSON.parse(kept) }],
      ],
    );
    const { rows: meta } = await fresh.query('select min_page_version from app_meta');
    assert.deepEqual(meta, [{ min_page_version: 4 }]);
    await fresh.close();
  });
});
