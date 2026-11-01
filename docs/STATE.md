# State

## Account data built for 100 users: migrations, versioned JSON, page versions, backups

Decided with the owner on 1 November 2026. Not started. To be built from the owner's laptop; nothing below has been run against the live project yet.

### Why

The live project (`etvrgexvjviavulflcqr`) got its schema by hand in the SQL editor before migrations existed, so Supabase's migration log there is empty although the tables exist (baseline `supabase/migrations/20261031000000_baseline.sql` = that schema). `.github/workflows/db.yml` only runs when `supabase/migrations/**` changes and skips itself without secrets, so nothing has gone wrong yet, but the first real run would try to re-create the tables. Beyond that one-off, the design has to hold once about 100 shepherds share offers:
- other people's data must never break (ADR-0005's «breaking saved data is fine» ends);
- several versions of the page run at once (phones keep old tabs open for days; GitHub Pages caches for minutes);
- a bad change must be recoverable.

Volume is not the issue: 100 users and a few thousand offers fit Supabase's free plan.

### Decisions

- Two kinds of change, two mechanisms, both delivered as migrations:
  - Table changes (a table, a column, an index, a policy): a normal migration. Expand, then contract: add first; remove only in a later release once no live page uses it; never rename in place.
  - Changes to an offer's JSON (`offers.terms`, `offer_mine.mine`, `settings.cfg`): batch-migrated in the database by a migration that rewrites every row in SQL (`jsonb` operators: move, rename, set a default) and bumps `schema_version`; the same migration raises `min_page_version` so old pages stop writing. Keep the SQL simple; logic that needs JavaScript (e.g. vacation defaults) stays in the page.
- The page keeps a small upgrader chain for copies a batch cannot reach: the browser's `localStorage` and backup files. One module owns the format (rename `src/saved.js` to `src/schema.js`, or keep the name and restructure): `SCHEMA_VERSION`, `upgrade[n]` turning version n into n+1, each with a fixture-row test. Every load path (browser, backup, account, shared) runs rows through the chain. Writes are always the current version and keep fields the page does not know.
- Page/database compatibility: the database states the oldest page version it accepts (`min_page_version`, a one-row table readable by everyone, or a `security definer` function). The page checks it at start and before writing; if too old, it shows «Hay una versión nueva. Recarga la página.» and stops writing. A row with a higher `schema_version` than the page knows is read without its unknown fields and never overwritten.
- No declarative schemas: they need Docker for `supabase db diff`, the generated diff still needs review (renames come out as drop + create), and some of our objects (the trigger on `auth.users`, policy details) may not round-trip. Readability comes instead from a generated, read-only schema snapshot committed by the Action.
- No server code: Supabase, the page and GitHub Actions only.

### Owner steps (Supabase and GitHub dashboards)

1. Done 1 November 2026: the old `SUPABASE_ACCESS_TOKEN` environment secret's token was revoked. Remove the secret from the Claude environment if it is still listed.
2. GitHub, repo → Settings → Secrets and variables → Actions, add:
   - `SUPABASE_ACCESS_TOKEN`: a personal access token from supabase.com/dashboard/account/tokens.
   - `SUPABASE_DB_PASSWORD`: the project's database password (Project Settings → Database; resetting it breaks nothing, the page uses the publishable key).
   - `SUPABASE_PROJECT_ID`: `etvrgexvjviavulflcqr`.
3. After plan step 1 is merged: Actions → Database → Run workflow → «mark baseline applied». Expect the migration list to show `20261031000000` on both sides and the drift check to report no difference.
4. For plan step 5: create a second free Supabase project for staging (same region, EU), and add `SUPABASE_STAGING_PROJECT_ID` and `SUPABASE_STAGING_DB_PASSWORD` as GitHub secrets. Configure Google sign-in on it only if the page will ever point at it (not needed for migration tests).
5. For plan step 4: create an encryption key for backups (e.g. `age-keygen`), store the public key as `BACKUP_PUBLIC_KEY` in GitHub secrets and the private key somewhere safe off GitHub (password manager). Without the private key the backups cannot be read.

### Plan

1. Fix the one-off mismatch: a manual trigger on the Database workflow.
   - `.github/workflows/db.yml`: add `workflow_dispatch` with a choice input `task`: `push` (default) or `mark-baseline-applied`.
   - `mark-baseline-applied` runs `supabase link --project-ref "$SUPABASE_PROJECT_ID"`, `supabase migration repair --status applied 20261031000000`, `supabase migration list`, then the drift check (step 2).
   - If `link` or `db push` asks for `supabase/config.toml`, run `supabase init` locally and commit it (the docs did not confirm whether it is needed).
   - Check: `actionlint` or a YAML parse; the run itself is the owner's step 3.
2. The Action as the single way the live schema changes.
   - Triggers: every push to `master` (not only migration paths), `workflow_dispatch`, and a daily `schedule` (also keeps the free project from pausing after a week without activity; confirm that a CLI connection counts as activity).
   - Steps: gate on secrets (keep the clean skip, but emit a warning annotation so a skipped run is visible); `npm ci`; `node --test test/unit/rls.test.js`; `supabase link`; `supabase db push`; drift check with `supabase db diff --linked` (or `supabase db diff --linked --schema public`), failing the run with the diff in the log when the live schema differs from the migrations; then `supabase db dump --linked --schema-only` written to `supabase/schema.snapshot.sql` and committed back to `master` only when it changed (a bot commit with `[skip ci]` in the message, `permissions: contents: write`). The snapshot is generated, never edited; say so in its first line.
   - Verify every command and flag against Supabase's current CLI docs before writing it (`db diff --linked` needs Docker? if so, run the drift check only on GitHub's runner, which has Docker, and document it).
   - Pin `supabase/setup-cli@v3` with an explicit CLI `version`.
3. Versioned JSON and page versions.
   - `src/schema.js` (or a restructured `src/saved.js`): `SCHEMA_VERSION`, the upgrader chain, `ingestSaved` and `ingestShared` running rows through it, writes in the current version keeping unknown fields. Today's ad-hoc conversions (flat offers, law keys dropped, `offerOnly` moved) become upgraders for the versions they belong to; fixture rows per version under `test/fixtures/schema/`.
   - Migration: `min_page_version` (table `app_meta(min_page_version int)` with one row and a select policy for `anon` and `authenticated`, or a `security definer` function `min_page_version()`), plus the page's own version constant, raised by hand when a change needs it.
   - `src/storage/account.js`: read `min_page_version` on connect and before each flush; if the page is older, stop syncing and show the reload notice (Spanish, AGENTS.md voice). Never write a row whose `schema_version` is higher than the page's.
   - Tests: unit tests for each upgrader and for unknown-field preservation; `test/unit/account.test.js` for the version gate with the fake client; `rls.test.js` applies the new migration and checks the policy.
4. Nightly encrypted backups.
   - A `backup` job (scheduled daily, also `workflow_dispatch`): `supabase db dump --linked` for schema and data (`--data-only` plus the schema snapshot, or the full dump; check the flags), encrypted with `age -r "$BACKUP_PUBLIC_KEY"`, uploaded as a workflow artifact with `retention-days: 90` (the repo is public: artifacts of a public repo can be downloaded by anyone signed in to GitHub, so encryption is mandatory; consider a private repo or another store if that is not acceptable).
   - `docs/restore.md`: how to download, decrypt (`age -d -i key.txt`) and restore into a fresh project (`psql` or `supabase db reset` against a staging project), and try it once on staging.
5. Staging.
   - Pushes to the working branch apply migrations to the staging project (same job with the staging secrets) and run the drift check there; `master` applies to production. A migration reaches production only after it ran on staging.
6. Records.
   - New ADR superseding ADR-0005: conversions are owed from now on; JSON changes are batch migrations plus page upgraders; expand then contract; `min_page_version`.
   - New ADR narrowing ADR-0016: triggers, drift check, schema snapshot, backups, staging; declarative schemas weighed and discarded.
   - `AGENTS.md` «Saved data»: «a field change is a batch migration + an upgrader + a fixture test, and raises `min_page_version` when old pages could write the old shape; a table change is a migration; expand, then contract; never change the live schema in the SQL editor».
   - `docs/model.md`: the format module and the version gate.
   - `docs/BACKLOG.md`: drop the ops item once the owner steps are done.
7. First real use: the «oferta trabajada» change (backlog item «offer | Decided by the owner on 1 November 2026…»).
   - Migration: move `offer_mine.mine->'offerOnly'` into `offers.terms` for every row (default `false`), remove it from `mine`, set `schema_version = 3`, raise `min_page_version`.
   - Page: `offerOnly` back in `DEF_TERMS`; upgrader v2 → v3 for browser copies and backups; «Solo oferta» shown on others' offers; a «Solo las trabajadas» filter for others' offers in Comparar, off by default.
   - New ADR superseding the first half of ADR-0017 (the sign-out half stands).

### Checks before calling it done

- `npm run check` and `npm test` pass; `rls.test.js` applies every migration including the new ones.
- On GitHub: the Database workflow green on `master` (push, schedule, manual), the drift check reporting no difference, the snapshot committed, one backup artifact present and decrypted once.
- A browser tab with the previous page version shows the reload notice after `min_page_version` is raised and does not write.
