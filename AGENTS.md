# AGENTS.md

Notes for anyone (person or agent) changing this code. The README says what the page is; this file says how to work on it.

## Language

- Code is in English: identifiers, comments, CSS classes, ids, data attributes, saved field names, commit messages.
- What the user sees is in Spanish (Spain). The page speaks to the reader as «tú», in the imperative when it asks for something ("Apunta", "Compara"). It never talks about itself: what the page does goes in the impersonal «se» ("Se rellenan…"), never as a verb that could be read as an order to the reader. Concise, neutral tone: no first person, no colloquialisms (no «tocan», «al banco»), no «gratis». «En mano» and «en negro» are fine for undeclared pay.

## Structure

- No build step. `index.html` holds the static markup and loads `src/main.js` as an ES module; an import map points `lit-html` at `vendor/lit-html/lit-html.js`. Because of the modules, the page has to be served over http (`node test/serve.js`); it does not open from `file://`.
- lit-html is the only library, copied from npm into `vendor/` (`npm run vendor` after changing its version in `package.json`). Use it for anything rendered from the state: views return templates and `app.js` renders them into their container. lit escapes what it inserts, so do not build HTML strings.
- Layers, each only importing from the ones before it: law and offer data → `model/` (every figure of an offer, no DOM) → words (`rights.js`, `text.js`, `units.js`) → `views/` (templates) → state, `ui/`, `app.js`, `events.js`, `main.js`. The words layer has no DOM of its own, but some words come as lit templates with tap-to-explain tips built with `withTip` from `views/parts.js`, the one allowed import from `views/` into it. `views/form.js` and `views/settings.js` fill the static markup instead of returning templates.
- `window.app` exposes the state and a few functions for tests and the console. Tests can also `await import('./src/…')` from the page.
- The same files are published as a Claude artifact. Saving to the user's Claude account (`storage/cloud.js`, `window.claude`) only works there; elsewhere everything stays in the browser.

## Style

- Formatting and lint: Biome (`npm run check`, `npm run format`). Types: TypeScript checks the JSDoc (`checkJs`), nothing is compiled. Add JSDoc where a shape is not obvious, as in `calc.js`.
- Names say what things are, in full English words. Comments say why, not what.

## Saved data

- Offers and settings live in `localStorage` (keys in `KEY`, in `state.js`), in backup files and in the Claude account document `data/users/<id>/estado`. All three load paths (browser, backup, Claude account) convert through `ingestSaved` in `legacy.js`.
- While the owner is the only user, a change to the saved format may break existing data: export a backup from Ajustes first, and new renames need no mapping in `legacy.js`. The existing conversions stay until someone removes them. Once anyone else saves offers, or accounts on a server arrive, conversions are owed again (ADR-0005).

## Legal figures

- Every legal or tax figure lives in `src/law.js`, with its source: minimum wage per year, working time, rest, vacation, severance, the overnight bonus, Social Security rates, unemployment benefit and IRPF. Code and texts read it from there (`LAW`, `minWageOf`, `SOCIAL_SECURITY`, `citeOf`); do not hard-code a legal figure anywhere else.
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

## Commits

- No `Co-Authored-By` or `Claude-Session` trailers.
- Prototype stage: work on a local branch, one concern per commit, and tidy it (amend, squash, reword) before it goes anywhere. When a feature is complete, fast-forward `master` to the branch and push `master` directly; the pre-push hook (`.githooks/`, enabled by `npm ci`) runs `npm run check` and `npm test` first. No pull requests for now.
- `master` is published as it is (GitHub Pages), so never rewrite it once pushed. A branch nobody else has pulled can be rewritten freely.
