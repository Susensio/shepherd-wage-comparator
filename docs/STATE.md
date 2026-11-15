# State

## One job with two sides: what was agreed and what happened (ADR-0035, accepted 15 November 2026)

Proposed 15 November 2026 from the owner's idea («una oferta y un registro son la misma cosa: una promesa de futuro y un hecho del pasado») and three reviews. Accepted by the owner with all decisions below as recommended, plus: lax entry with few required fields (a past job by its conditions only, by what happened only, or both), hours not required. Correctness fixes (round 15) done 15 November 2026 (pushed on the branch, not on master); phase A starts from them.

### Plan
- Phase A, done 15 November 2026 (commits 1f6992e…c31e02a on the branch): structure with no visible change: `model/phase.js` owns worked/start/end/phase/facts; `model/days.js` owns the days of a month and the month share; `settle` takes `r` and never calls `calc`; `monthAccounts` takes `settled`; `figuresOf(o)` memoised per paint; a pure `model/job-view.js` out of `ui/record.js`; every mutation through `offers.js`; `ui/navigation.js` without DOM at import; `normalizeRecord` keeps unknown sub-fields.
- Phase B, the model: saved format 8 (`paid: asAgreed|none` replacing `nothingPaid`; `upgrade[7]` must delete `nothingPaid` itself, since `normalizeRecord` now keeps unknown fields; month `count`, approximate lump cobros), `happenedOf`, `actualFigures`.
- Phase C, the screens: the Registro as a page; the ficha by state with «¿Se cobró este trabajo?» (Sí, todo / No todo / No se cobró nada, the last confirmed); «Trabajo ya hecho»; the list calm (grey «Sin registro» for old jobs, amber only while a deadline runs); Comparar with «real»/«pactado» tags; the message to the ganadero as a closed fold.

### Owner decisions
1. Tab name «Trabajos» (offers under «Por decidir»).
2. «Sí, todo» means what was agreed was received; a shortfall under the minimum still shows, labelled.
3. Days per month as counts, besides the total.
4. Hours not required in the quick entry (owner, replacing the recommendation).
5. Year headers as one sum (cobrado where known, else agreed, marked «≈»).
6. Lapsed old jobs: the shortfall grey, «prescrito», never red.
7. «Año a año» leaves Comparar.

## Union assistant: Reclamar as a guided ladder, the dossier, how the job ended (ADR-0034, proposed)

Started 14 November 2026 while the owner was away, under their mandate («asistente sindical, gestor y ayuda al pastor»); the owner confirms ADR-0034 on return. Nothing of it on `master` until they do.

Progress, 14 November 2026 (owner away): phase 1 built on the branch (`3c28d4f`..`06da834`), reshaped by the owner («lo común es reclamarle al ganadero»): the block is «Pedir lo que falta», with «Hablar con el ganadero» and «Petición de pago» open first and the formal steps in one closed fold «Si no paga: la vía legal»; a dismissal's 20-working-day date as one plain line. Saved format 6 with its migration `20261114120000_claim_ladder_in_mine.sql` (`min_page_version` 5): not on `master` until the owner approves ADR-0034 and exports a backup. Also on the branch: the offer menu follows its button on scroll (the card-menu tests had been failing most runs); the petition says gross and net apart. A second review of the new flow found that the end of the job did not change the money; round 12 (`67a49d1`..`523b29e`) fixed it and 19 more findings: the end the shepherd says ends the job in `settle`; one claim text (the Petición, gross only); dates asked empty and validated; sick leave a status, not an end; a fijo discontinuo asked whether it was called back; the dismissal line says what to do; «Para reclamar» includes finished jobs with no cobros; «Cuentas saldadas» calm; the summary while the job goes on; a promise to pay. Format 6 gained `record.sick`, `record.recall`, `claim.steps[id].promise` (still unreleased). Verified 15 November: check, 464 unit, 400 e2e.

### Plan (phase 1: no new legal data)

1. Glossary: «Reclamar» as the ladder; one term per step («Hablar con el ganadero», «Petición de pago», «Sindicato», «Papeleta de conciliación», «Inspección de Trabajo», «Juzgado de lo Social», «FOGASA»); «Expediente», «Resumen para el ganadero», «¿Cómo acabó?», «Cuentas saldadas», «Para reclamar».
2. `law.js`: sources `lrjs` (BOE-A-2011-15936), the ITSS mailbox, FOGASA, Importass (vida laboral), Aragón's conciliation procedure (https://www.aragon.es/tramitador/-/tramite/conciliaciones/laboral-preceptiva-previa-a-la-jurisdiccion-social, temporary until the knowledge base); figures `dismissalDays` 20 working days (ET 59.3), `conciliationResumeDays` 15 (LRJS 65.1), `conciliationEndDays` 30 (Aragón page).
3. `src/model/claim.js` (pure): the steps in order with `applies`, `deadline`, `lapsed`, `done`; `dismissalDeadline(date)` = 20 weekdays after the day after, holidays ignored (conservative). Unit tests: a Friday dismissal, August, lapsed months.
4. `src/text.js`: «Resumen para el ganadero» (net, by item and month, no citations, ends «¿Cuándo se puede pagar?»), «Petición de pago» (gross, a pay-by date, default +15 days; no claim that it stops the deadline), «Hechos para la Inspección» (facts only), the papeleta's fields; amounts equal `settle`/`standingOf`.
5. Saved format 6: `mine.record.end = { how: agreed|dismissed|quit|sick, date }`, `mine.parties = { employerName, employerId?, workerName? }`, `months[k].closedAt`, `record.evidence = [{ date, text }]`, `mine.claim = { steps: { id: { done, note? } } }`; upgrader, fixture, migration, `rls.test.js`, `PAGE_VERSION`/`min_page_version`. Owner exports a backup before `master`.
6. `src/views/claim.js`: the «Reclamar» block replacing today's in Acabada; shown when Falta > 0, when dismissed, or with no cobros (prompt); dismissal first in red; «Hecho» per step; the disclaimer. Aragón offices: Huesca C/ Ricardo del Arco 6, 2ª, 974 293 017; Zaragoza Pº Fernando el Católico 63-65, 976 715 946; Teruel C/ San Francisco 1, 1ª, 978 641 182 (from the aragon.es page; elsewhere «el servicio de mediación de la comunidad»).
7. Cards «¿Empezó el trabajo?» (Por decidir on or after the start) and «¿Cómo acabó?» (Acabada, or «Acabó antes» in the «⋯» menu).
8. The «Expediente»: `views/dossier.js` with a history entry, print CSS (no app chrome), «Imprimir o guardar PDF»; totals equal the Cuentas tiles.
9. Offers list: a «Para reclamar» group first; the next step and its date on the card.
10. Leyes: «Dónde reclamar» rewritten as the ladder in brief.
11. Hints without data: the finiquito («recibí» or «no conforme», never «recibí y conforme» if it does not add up; a representative may attend, ET 49.2), vida laboral link, «certificado de empresa» for the paro, the guest backup nudge when something is owed.
12. Docs: `docs/model.md` (claim section).

Left out until verified (memory only): interest for late pay (ET 29.3), in-kind limits (ET 26.1), FOGASA ceilings (ET 33), whether August counts in dismissal deadlines (LRJS 43.4), free legal aid. Phase 2 with the knowledge base: mediation office per province, the dismissal date with holidays, agreements per province, gross per cobro, hours and notes per day.

## Knowledge base for territorial law figures (ADR-0033)

Decided with the owner on 14 November 2026: documents with provenance, distilled reports, verified tables and a build script that generates the page's data; no servers; review by a summary table shown by the main agent; where no agreement is known the general rules of Spain apply and nothing above the entitlement is claimed. Nothing built yet. The full design of 14 November (manifest fields, report template, table schemas, validation checks, job roles) was written by a design agent and lives in the conversation; this plan is its first slice, to be written into `kb/README.md` as it is built.

Progress, 14 November 2026 (owner away): step 2 done on the branch (`9a0896a`: the bonus only for `HU`); steps 3–5 partly done (`24f2bae`..`0efd404`): `kb/manifest.json` (12 records), `kb/text/` (10 extracts), `kb/tables/holidays.csv` (Aragón 2026: 12 national and regional days, and the two local days of 14 Pyrenean villages: Aínsa-Sobrarbe, Plan, San Juan de Plan, Gistaín, Yebra de Basa, Bielsa, Boltaña, Broto, Torla-Ordesa, Fiscal, Benasque, Biescas, Sabiñánigo, Jaca), `scripts/build-law-data.js --check` run by `npm test`. All rows are `checked` (quote found verbatim), none `verified`: the owner verifies them from the two review tables. The Huesca agreement is the «Convenio colectivo del sector agrícola de la provincia de Huesca» (22000015012004): the last text found is 2015–2017 (art. 29, the 25 % clause), a 2018–2021 agreement followed (2021 tables in BOPH 202/2023), no 2022–2025 text found in the BOPH; `agreement_terms.csv` is empty until the owner provides the reference. Release assets for originals not set up (`link-only`).

Found 15 November 2026 (research agent, documents fetched): the Huesca agreement in force is the «Convenio colectivo del sector agrícola de la provincia de Huesca» 2022–2025 (code 22000015012004), BOPH nº 131, 9 July 2024, text at https://www.boa.aragon.es/cgi-bin/EBOA/BRSCGI?CMD=VEROBJ&MLKOB=1342050573232; art. 5 keeps it applying until a new one is signed (none in REGCON as of 15 November 2026). Art. 28: the overnight bonus, «no inferior al 25 por 100 del salario del Convenio»; art. 35: overtime +75 % on working days, +100 % on holidays; art. 25: 1,760 hours a year, 40 a week on average; art. 30: 30 natural days of vacation. Shepherd (Pastor/a, art. 11.10) salary: 2025 provisional tables in BOPH nº 87, 14/05/2025: 16,576 €/year (the 2025 SMI), 36.50 €/day; in 2026 the SMI (17,094 €) is higher. To do: add these documents and rows to `kb/` for the owner's review, cite art. 28 with the URL in `law.js`, and take the 1,760 annual hours for Huesca offers.

### Plan (first slice)

1. `AGENTS.md`: «Legal figures» says territorial figures come from `kb/tables` through `scripts/build-law-data.js` and `law.js` lookups; a short «Knowledge base» section points at `kb/README.md`.
2. Interim, before the data exists: the overnight bonus is owed only for offers in Huesca (province `HU`), from the 2022–2025 agreement; elsewhere and with no province known it is not counted as owed. `law.js` cites the 2022–2025 text, not the 2015–2017 one.
3. `kb/` skeleton and manifest seed: BOE-A-2025-21667, Aragón Decreto 70/2025, the BOA 225/2025 local list and its correction BOA 56/2026, Aragón's CKAN `festivos_aragon_2026_completo.csv`, the Huesca agreement 2022–2025 (find its BOP reference), the owner's table as owner-private.
4. A collector run (GitHub Action, `workflow_dispatch`) fetching, hashing and extracting text; release `kb-2026`.
5. Tables and reports for the two pilots: holidays of Aragón 2026 (national, regional, local for a few municipalities, Yebra de Basa among them) and the Huesca agreement's overnight bonus, overtime and weekly hours, each row with a verbatim quote.
6. `scripts/build-law-data.js` with its validation in `npm test`; `src/law-territorial.js` and `data/holidays-2026-02.json`.
7. The calendar marks holidays (national, regional and local where known), after the record's calendar work.

### Owner steps

- Say which villages the shepherds work in most, for the local-holiday pilot.
- Verify the figures from the summary tables the main agent shows (answer «vale» or point at the row).
- Confirm the Huesca agreement's reference if it cannot be found.

## What happened: a record of days and payments, settled against the offer (phases)

Decided with the owner on 12 November 2026 (ADR-0032). Core first, interface after: no screen is built until `settle` and the saved format are done and tested.

Progress, 12 November 2026: steps 1 and 2 are done on branch `ccr-32fbee75-oc1p8v` and not on `master` (`settle`, `phaseOf`, saved format 5 with its migration `20261112120000_record_in_mine.sql`, `PAGE_VERSION` and `min_page_version` 4). Pushing `master` applies that migration to the live account rows: the owner exports a backup first. Step 3: mock-ups at https://claude.ai/artifact/Qvpa7UQPeiQ4mDrNUSzbN6 (version 3); decided by the owner: payments net, a day is jornada, libre or baja (vacation is not a mark), months from the start date, a month closes only after its calendar was shown, differences judged by counts, «+ Apuntar cobro» as a block of its own, a «Varios días» mode instead of dragging. A payment's `via`: only `payroll` is declared; `transfer` (without a payslip) and `cash` are en negro. Step 4 (interface) is next; the owner finds the post-work part overloaded, to iterate once built.

### Plan

1. Core, no DOM. (Done.)
   - `src/model/settle.js`: `settle(offer, record, today)` as in ADR-0032: per month and item, due (real days for a closed month, the model's averages for an open one), received (payments, oldest unpaid month first), owed (the greater of agreed and minimum, per ADR-0004), cash apart, claim deadline per unpaid month.
   - `src/model/phase.js`: `phaseOf(offer, today)`: undecided, under way, finished; «solo oferta» never worked.
   - Unit tests with a fixture per case. The invariant: an empty record gives the ficha's figures for every sample offer.
2. Saved format 5 (ADR-0023): `mine.record = { months: {}, payments: [] }`; migration in `supabase/migrations/` and `upgrade[5]` in `schema.js` with a fixture; extend `test/unit/rls.test.js`; raise `PAGE_VERSION` only if old pages could write the old shape. Export a backup first.
3. Mock-ups before code (artifacts, as in the redesign): the ficha in its three phases, the month calendar (pre-marked, one tap toggles, a second gesture for sick or vacation, range by dragging, «Cerrar mes»), the quick «+ Cobro».
4. Interface, after the mock-ups are chosen: the phase's top block in the ficha, the calendar, the payments list, the cards' phase tag, `docs/model.md` and `docs/glossary.md` (new terms: registro, mes cerrado, cobro, fase), voice per ADR-0024.

### Open

- Hours (overtime) in the record: left out of the first version.
- Whether the tab and the cards stop saying «Ofertas» for jobs that were worked: decide with the mock-ups.
- A reminder to record as the work goes: nothing in the page can nudge today.

## Account data built for 100 users: migrations, versioned JSON, page versions, backups

Decided with the owner on 1 November 2026. Started 4 November 2026. Live on `master` the same day: plan steps 1 (manual baseline task; owner step 3 run, green), 2 (every push and daily, drift check, schema snapshot by the bot) and 3 (`schema.js`, `app_meta` migration applied to the live project, version gate; ADR-0023). Steps 4–5 deferred until a second shepherd uses the account (backlog «backups»; owner steps 4–5 not needed until then). Step 6 done (ADR-0023, ADR-0026, `AGENTS.md`). Step 7 done the same day (ADR-0028; the owner exported a backup first): schema version 3, `offerOnly` and the village in `terms`. Nothing left but steps 4–5, deferred; this section can go once they are taken up or dropped. Lesson: `git push` to `master` from a cloud session can fail with «Internal Server Error» while the pre-push hook runs its 3 minutes of tests with the connection open; run `npm run check && npm test` first and push the same commit with `--no-verify`.

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

1. Done 1 November 2026: the old `SUPABASE_ACCESS_TOKEN` environment secret's token was revoked; by 4 November it is no longer in the Claude environment.
2. Done 4 November 2026 (repository secrets, no GitHub Environment). GitHub, repo → Settings → Secrets and variables → Actions, add:
   - `SUPABASE_ACCESS_TOKEN`: a personal access token from supabase.com/dashboard/account/tokens.
   - `SUPABASE_DB_PASSWORD`: the project's database password (Project Settings → Database; resetting it breaks nothing, the page uses the publishable key).
   - `SUPABASE_PROJECT_ID`: `etvrgexvjviavulflcqr`.
3. After plan step 1 is merged: Actions → Database → Run workflow → «mark baseline applied». Expect the migration list to show `20261031000000` on both sides and the drift check to report no difference.
4. For plan step 5: create a second free Supabase project for staging (same region, EU), and add `SUPABASE_STAGING_PROJECT_ID` and `SUPABASE_STAGING_DB_PASSWORD` as GitHub secrets. Configure Google sign-in on it only if the page will ever point at it (not needed for migration tests).
5. For plan step 4 (the only backup there is: the owner confirmed on 4 November 2026 that the free plan offers none): create an encryption key for backups (e.g. `age-keygen`), store the public key as `BACKUP_PUBLIC_KEY` in GitHub secrets and the private key somewhere safe off GitHub (password manager). Without the private key the backups cannot be read.

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
7. First real use: the «oferta trabajada» change (backlog item «offer | Decided by the owner on 1 November 2026…»), and in the same migration the village moving to `terms` (backlog item «privacy | Decided by the owner on 4 November 2026…»).
   - Migration: move `offer_mine.mine->'offerOnly'` into `offers.terms` for every row (default `false`), and `offer_mine.mine->'place'` likewise; remove both from `mine`, set `schema_version = 3`, raise `min_page_version`.
   - Page: `offerOnly` back in `DEF_TERMS`; upgrader v2 → v3 for browser copies and backups; «Solo oferta» shown on others' offers; a «Solo las trabajadas» filter for others' offers in Comparar, off by default.
   - New ADR superseding the first half of ADR-0017 (the sign-out half stands).

### Checks before calling it done

- `npm run check` and `npm test` pass; `rls.test.js` applies every migration including the new ones.
- On GitHub: the Database workflow green on `master` (push, schedule, manual), the drift check reporting no difference, the snapshot committed, one backup artifact present and decrypted once.
- A browser tab with the previous page version shows the reload notice after `min_page_version` is raised and does not write.
