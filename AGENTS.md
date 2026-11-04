# AGENTS.md

Notes for anyone (person or agent) changing this code. The README says what the page is; this file says how to work on it.

## Language

- Code is in English: identifiers, comments, CSS classes, ids, data attributes, saved field names, commit messages.
- What the user sees is in Spanish (Spain), in two voices split by what a sentence does (ADR-0024). Questions, answers, labels, headings, figures and explanations are impersonal, written in the plainest form rather than translated from «tú»: a noun for a label («Pago», «Ganado», «Coche propio»), an explicit subject where there is one («¿Pone casa el ganadero?», «Lo que debe el ganadero»), the domain term where there is one («¿Hay pernocta en el monte?»), «se» where nothing plainer exists («Se pagan aparte, al acabar»). An instruction to the reader keeps «tú», in the imperative ("Apunta", "Compara", "Toca una oferta"). No first person anywhere (no «Me las pagan», no «Con mi coche»), and no second-person verb or «tu/tus» outside an instruction.
- What the page itself does goes in the impersonal «se» ("Se rellenan…"), never as a verb that could be read as an order to the reader. Place every new string on one side: it asks, answers or labels (impersonal), or it tells the reader to act («tú»). Concise, neutral tone: no colloquialisms (no «tocan», «al banco»), no «gratis». «En negro» is the term for undeclared pay.
- One term per concept, as listed in `docs/glossary.md` (with the code identifier behind each). Check new text against it, and add a new concept there before using it.

## Structure

- No build step. `index.html` holds the static markup and loads `src/main.js` as an ES module; an import map points `lit-html` at `vendor/lit-html/lit-html.js`. Because of the modules, the page has to be served over http (`node test/serve.js`); it does not open from `file://`.
- Three libraries, copied from npm into `vendor/` (`npm run vendor` after changing a version in `package.json`): lit-html; MiniSearch, the village search (ADR-0019), mapped as `minisearch` in the import map and resolved from `node_modules` by the Node tests; and supabase-js as its UMD bundle, which `storage/account.js` loads only once a user signs in (ADR-0006). Google's sign-in script is not vendored: `storage/google-sign-in.js` loads it from Google only while a sign-in choice is on screen (ADR-0009). Use lit-html for anything rendered from the state: views return templates and `app.js` renders them into their container. lit escapes what it inserts, so do not build HTML strings.
- Layers, each only importing from the ones before it: law and offer data (with `format.js` and `ledger.js`, the rounding of ledger rows and their «=» sums; and `dom.js`, the `$`/`$$` element lookups, which `views/form.js` and `views/settings.js` use to fill the static markup) → `steps.js` (the steps an offer is entered in, and which one holds each thing that can be missing) → `model/` (every figure of an offer, no DOM) → words (`rights.js`, `text.js`, `units.js`, `explanations.js`) → `views/` (templates) → state (`state.js`, and `offers.js`, which owns the offers list, the first-visit placeholder, the active offer and saving them, and `account-state.js`, which owns the account's status and whether other shepherds' offers can be read: no DOM, its account injected, the UI only paints it and calls its actions), `storage/` (the account, backups, the places list, Google sign-in), `ui/`, `app.js`, `events.js`, `main.js`. `storage/` and `ui/` read the state and may import from each other and from `views/`, but `storage/` should hold persistence only; tabs, pages, the ficha and the entry (with their history entries, so the phone's Back works) live in `ui/navigation.js`; `ui/entry.js` moves between the steps. `ui/offer-menu.js` is the «⋯» menu of the ficha and the cards. The words layer has no DOM of its own, but some words come as lit templates with tap-to-explain tips built with `withTip` from `views/parts.js`, the one allowed import from `views/` into it. `views/form.js` fills the static markup of the entry's steps (one `<section class="step">` each in `index.html`, all inside the one form, so ids are unique) and `views/settings.js` that of Ajustes, instead of returning templates; `views/ficha.js` and `views/offers-list.js` return templates (ADR-0020).
- `window.app` exposes the state and a few functions for tests and the console. Tests can also `await import('./src/…')` from the page.

## Style

- Formatting and lint: Biome (`npm run check`, `npm run format`). Types: TypeScript checks the JSDoc (`checkJs`), nothing is compiled. Add JSDoc where a shape is not obvious, as in `calc.js`.
- Names say what things are, in full English words. Comments say why, not what.

## Saved data

- Offers and settings live in `localStorage` (keys in `KEY`, in `state.js`), in backup files and, signed in, in the Supabase account, which is then the source of truth with `localStorage` as its cache. All load paths (and other shepherds' shared offers) go through `src/schema.js`, which owns the format: `SCHEMA_VERSION`, the upgrader chain, `PAGE_VERSION`.
- An offer is `{ id, cmp, terms, mine }` (ADR-0007). `terms` is what the employer offers and is shared with other users who share too (ADR-0006); `mine` is the shepherd's own and never leaves their account. A new field goes in `terms` only if it describes the job, not the shepherd: whether the offer was worked and its village are facts about the job, so they are terms (ADR-0028).
- `supabase/migrations/` holds the account tables and their row-level security, and is the only source of the schema. A database change is a new file there (`supabase migration new <name>`, or `<YYYYMMDDHHMMSS>_<name>.sql` by hand); never edit one already pushed. `test/unit/rls.test.js` applies every migration in order offline with PGlite, so extend it for the change. On every push to `master` and daily, `.github/workflows/db.yml` runs `supabase db push` against the project, fails if the live schema drifts from the migrations, and commits the generated `supabase/schema.snapshot.sql` (never edit it; rebase on the bot's commits before fast-forwarding `master`) (ADR-0026); never change the live schema in the SQL editor, which breaks `db push`. Table changes expand, then contract: add first, remove only once no live page uses it, never rename in place.
- `storage/account-config.js` holds the project URL, the publishable key, Google's client ID and the `emailSignIn` switch, all public. With a null `url` every account feature is off; the browser tests serve their own config (`test/e2e/fake-account.js`).
- Saved data never breaks (ADR-0023). A change to an offer's or the settings' JSON is a migration that rewrites every account row in SQL and bumps `schema_version`, plus an `upgrade[n]` in `schema.js` with a fixture under `test/fixtures/schema/` for browser copies and backups; it raises `app_meta.min_page_version` (and `PAGE_VERSION`) when old pages could write the old shape. Before a risky change, export a backup from Ajustes (the cog at the top right).

## Legal figures

- Every legal or tax figure lives in `src/law.js`, with its source: minimum wage per year, working time, rest, vacation, severance, the overnight bonus, Social Security rates, unemployment benefit and IRPF. Code and texts read it from there (`LAW`, `minWageOf`, `ssOf`, `citeOf`); do not hard-code a legal figure anywhere else.
- Law figures are not settings: the user cannot change them in Ajustes, and `ingestSaved` drops saved values for them (ADR-0014). Ajustes holds only what differs between shepherds.
- Figures inside the HTML text are `<span data-law="key">` placeholders filled by `views/law-figures.js`; links to sources are `<a data-source="et" data-art="38">`.
- Each January, add the new minimum wage to `MIN_WAGE` and review the rest of `law.js`. `test/unit/law.test.js` fails once the current year is missing.

## Figures

- The model in `model/` follows Spanish labour law (sources in the Leyes tab). Fix display problems in the display code; do not bend the maths to make a figure look right.
- Every ledger on the page must add up on screen: a row with «=» has to come out of the rows above it, with the same rounding that is shown. `test/e2e/consistency.spec.js` checks this for every sample offer.

## Checking changes

- `npm run check`, then `npm test` (unit tests in Node, then the page in headless Chromium; first time: `npx playwright install chromium`). CI runs the same on every push and keeps the traces of failed tests.
- Never commit real user data: the sample offers in `test/fixtures/` are anonymised (names like «Puerto A», amounts multiplied by 1.05).
- Pure calculations go in unit tests. Browser tests are for what needs the page: what it shows, the flows, loading saved data.
- The page is mobile-first: look at it at 375 px wide, in light and dark mode.

## Records

- `docs/adr/`: numbered records of settled choices between alternatives. In English. The main agent writes them.
- `docs/model.md`: what the model's figures mean, and the rules that cross files. In English.
- `docs/BACKLOG.md`: open ideas and defects nobody is working on yet. In English. The main agent writes it.
- `docs/STATE.md`: work decided or started and not finished yet, with its plan. In English. The main agent writes it.

## Commits

- No `Co-Authored-By` or `Claude-Session` trailers.
- Prototype stage: work on a local branch, one concern per commit, and tidy it (amend, squash, reword) before it goes anywhere. When a feature is complete, fast-forward `master` to the branch and push `master` directly; the pre-push hook (`.githooks/`, enabled by `npm ci`) runs `npm run check` and `npm test` first. No pull requests for now.
- `master` is published as it is (GitHub Pages), so never rewrite it once pushed. A branch nobody else has pulled can be rewritten freely.
