# ADR-0026: Run the Database workflow on every push and daily, with a drift check and a generated schema snapshot, instead of only on migration changes, and without declarative schemas

Status: Accepted
Date: 2026-11-04
Narrows: [ADR-0016](0016-migrations-github-action.md)

## Context

ADR-0016 applied migrations from `.github/workflows/db.yml` on pushes to `master` that touched `supabase/migrations/`. The live project's schema had been made by hand before migrations existed, so its migration log was empty while the tables existed; the first real run would have tried to create them again. The plan decided with the owner on 1 November 2026 (see `docs/STATE.md`, account data) asked that the workflow be the only way the live schema changes, that differences be noticed, and that the schema be readable without opening every migration.

Weighed and discarded:
- Declarative schemas (`supabase/schemas/`, diffed into migrations): `supabase db diff` needs Docker locally, the generated diff still needs review (renames come out as drop and create), and some objects (the trigger on `auth.users`, policy details) might not round-trip.
- Supabase's GitHub integration (4 November 2026): it also applies migrations on push, but has no offline policy test, no drift check and no snapshot; two deployers would race on the migration log, and its per-branch databases cost money with no spend cap while every cloud session pushes its own branch.
- Supabase Pro backups and a staging project: deferred until a second shepherd uses the account (backlog).

## Decision

- The workflow runs on every push to `master`, daily, and by hand. A manual task `mark-baseline-applied` recorded the baseline as applied once (run by the owner on 4 November 2026); running it again is harmless.
- Each run: the offline policy test (`rls.test.js`), `supabase link`, `supabase db push`, a drift check (`supabase db diff --linked --schema public`, failing the run when the live schema differs from the migrations), and `supabase db dump` into `supabase/schema.snapshot.sql`, committed back to `master` by the bot with `[skip ci]` only when it changed. The snapshot is generated and never edited, which keeps ADR-0016's objection to a hand-kept second copy.
- A run without the secrets skips itself with a warning annotation.
- The job installs with `npm ci --ignore-scripts`: the `prepare` script enables the repository's pre-push hook, which made the bot's snapshot push run the browser tests on a runner without a browser (first run, 4 November 2026).

## Consequences

- A change made outside migrations fails the next run, at the latest the next day.
- `master` gains bot commits; a local branch has to be rebased on them before its next fast-forward.
- The daily run is also meant to keep the free project from pausing after a week idle; whether a CLI connection counts as activity was not confirmed.
- `db diff` and `db dump` need Docker, which GitHub's runners have and the agents' cloud sessions do not, so the checks run only in the workflow.
