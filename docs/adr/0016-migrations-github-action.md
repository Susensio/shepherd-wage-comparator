# ADR-0016: Keep the account schema as migrations applied by a GitHub Action, instead of pasting schema.sql into the SQL editor

Status: Accepted
Date: 2026-11-01

## Context

Until 31 October 2026 the account tables and their row-level security lived in `supabase/schema.sql`, pasted by hand into Supabase's SQL editor, with nothing recording what had run on the live project. The owner asked how to make database changes more comfortable as fields are added. Supabase documents keeping migrations in the repository and applying them from CI with its CLI.

Weighed and discarded:
- Keeping `schema.sql` and pasting changes by hand: nothing tests what runs on the live project, and nothing records it.
- An access token kept as a secret of the agents' environment, so sessions push changes themselves: every session would hold a token to the production database.
- Keeping `schema.sql` beside the migrations as a snapshot: two copies drift.

## Decision

- The schema is the ordered files in `supabase/migrations/`, the first a baseline equal to the old `schema.sql`, which is removed.
- `test/unit/rls.test.js` applies the migrations in order, offline in PGlite.
- `.github/workflows/db.yml` applies them to the live project (`supabase link`, `supabase db push`, `supabase/setup-cli@v3`) on pushes to `master` that touch the migrations, and skips itself while the GitHub secrets are missing. The owner marks the baseline as applied once (`supabase migration repair`).

## Consequences

- A database change is a new migration file, tested before it reaches the project; the token lives only in GitHub.
- The page (GitHub Pages) and the database deploy from the same push, so a migration must work with both the old and the new page: add, never rename or drop.
- Changes made in the SQL editor outside migrations break `db push`.

