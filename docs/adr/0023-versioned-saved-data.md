# ADR-0023: Owe conversions again: batch migrations in the database plus an upgrader chain in the page, gated by min_page_version, instead of breaking saved data or converting only on read

Status: Accepted
Date: 2026-11-04
Supersedes: [ADR-0005](0005-relaxed-saved-data.md)

## Context

ADR-0005 let a change to the saved format break existing data while the owner was the only user. On 1 November 2026 the owner decided, with the agent, that the design should hold for about 100 shepherds sharing offers through the Supabase account (ADR-0006), before the first of them arrived. Three forces were named: other people's data must never break; several versions of the page run at once (phones keep tabs open for days, GitHub Pages caches for minutes); a bad change must be recoverable.

Saved offers live in three places: account rows (`offers.terms`, `offer_mine.mine`, `settings.cfg`, each row with a `schema_version`), the browser's `localStorage`, and backup files. Only the first is reachable from the database.

Weighed:
- Converting only on read in the page, as ADR-0002 did: every old shape stays in the database forever, every page version must read all of them, and an old page can write an old shape back over a converted row.
- Converting only in the database: cannot reach `localStorage` or backup files.
- Logic that needs JavaScript (e.g. vacation defaults) in SQL: kept out; SQL migrations stay to simple `jsonb` moves, renames and defaults.

## Decision

- A change to an offer's or the settings' JSON is a database migration that rewrites every row in SQL and bumps `schema_version`, plus an upgrader in the page's format module (`upgrade[n]`, version n to n+1, each with a fixture test) for the copies the batch cannot reach. Every load path (browser, backup, account, shared) runs rows through the chain. Writes are always in the current version and keep fields the page does not know.
- The database states the oldest page it accepts, `min_page_version` in a one-row `app_meta` table readable by everyone and writable by no API role (a table rather than a `security definer` function: the value is data a later migration updates, not code to redefine). The page carries its own version, raised by hand. It reads the minimum on connect and before each write; a page that is too old stops writing and asks for a reload. A migration that changes the JSON raises the minimum when old pages could write the old shape.
- A row with a higher `schema_version` than the page knows is read without its unknown fields and never written back.
- Table changes are ordinary migrations, expand then contract: add first, remove only in a later release once no live page uses it, never rename in place.

Built on 4 November 2026 (plan step 3 in `docs/STATE.md`): `SCHEMA_VERSION` 2, `PAGE_VERSION` 1, one upgrader (flat offers to `{id, cmp, terms, mine}`, law figures dropped from settings). The `offerOnly` move of ADR-0017 had happened without a version bump, so it stayed a normalisation rather than an upgrader; the «oferta trabajada» change reverses it as the first real batch migration.

## Consequences

- Every change to the saved format now costs a migration, an upgrader, a fixture and possibly a raised minimum; renames are no longer free.
- An old tab cannot corrupt converted rows; its owner sees «Hay una versión nueva. Recarga la página.» and keeps unsynced edits for the next load.
- A missing `app_meta` table or row means no minimum, so the page can ship before its migration is pushed.
- The format has two implementations of each change (SQL and JavaScript) that must agree; the fixture tests cover the JavaScript side, `rls.test.js` (PGlite) the SQL side.
- The live rule is the Saved data section of `AGENTS.md`; what the figures mean is in `docs/model.md`.
