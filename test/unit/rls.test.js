// Row-level security of supabase/schema.sql against Postgres in WASM, with a stub of what Supabase provides.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { before, describe, test } from 'node:test';
import { PGlite } from '@electric-sql/pglite';

const SCHEMA = readFileSync(new URL('../../supabase/schema.sql', import.meta.url), 'utf8');

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
  await db.exec(SCHEMA);
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
      ('${OFFER.ana}', '${ID.ana}', '{}', 1),
      ('${OFFER.ben}', '${ID.ben}', '{}', 1),
      ('${OFFER.dan}', '${ID.dan}', '{}', 1);
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
    await db.exec(SCHEMA);
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
    assert.deepEqual(await column(null, `select schema_version from offers where id = '${OFFER.ben}'`), [1]);
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

describe('account deletion', () => {
  test('removes every row of the user', async () => {
    await as(null, 'delete from auth.users where id = $1', [ID.ben]);
    assert.deepEqual(await column(null, `select user_id from profiles where user_id = '${ID.ben}'`), []);
    assert.deepEqual(await column(null, `select user_id from settings where user_id = '${ID.ben}'`), []);
    assert.deepEqual(await column(null, `select id from offers where user_id = '${ID.ben}'`), []);
    assert.deepEqual(await column(null, `select offer_id from offer_mine where offer_id = '${OFFER.ben}'`), []);
  });
});
