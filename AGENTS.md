# AGENTS.md

Notes for anyone (person or agent) changing this code. The README says what the page is; this file says how to work on it.

## Language

- Code is in English: identifiers, comments, CSS classes, ids, data attributes, saved field names, commit messages.
- What the user sees is in Spanish (Spain). The page speaks to the reader as «tú», in the imperative when it asks for something ("Apunta", "Compara"). It never talks about itself: what the page does goes in the impersonal «se» ("Se rellenan…"), never as a verb that could be read as an order to the reader. Concise, neutral tone: no first person, no colloquialisms (no «tocan», «al banco»), no «gratis». «En mano» and «en negro» are fine for undeclared pay.

## Structure

- No build step. `index.html` holds the static markup and loads `src/main.js` as an ES module; an import map points `lit-html` at `vendor/lit-html/lit-html.js`. Because of the modules, the page has to be served over http (`python3 -m http.server`); it does not open from `file://`.
- lit-html is the only library, copied from npm into `vendor/` (`npm run vendor` after changing its version in `package.json`). Use it for anything rendered from the state: views return templates and `app.js` renders them into their container. lit escapes what it inserts, so do not build HTML strings.
- Layers, each only importing from the ones before it:
  - `format.js`, `law.js` → `offer.js` → `legacy.js` → `model/` (`calc()`: every figure of an offer, grouped by subject; no DOM) → `rights.js`, `explanations.js`, `text.js` (words, no DOM; some come as lit templates with tap-to-explain tips, from `views/parts.js`).
  - `views/` turn an offer and its figures into templates. `form.js` and `settings.js` fill the static markup instead.
  - `state.js` (the state and `localStorage`), `ui/`, `app.js` (paints everything), `storage/` (backups, the Claude account), `events.js` (every `data-action` button and field), `main.js` (startup).
- `window.app` exposes the state and a few functions for tests and the console. Tests can also `await import('./src/…')` from the page.
- The same files are published as a Claude artifact. Saving to the user's Claude account (`storage/cloud.js`, `window.claude`) only works there; elsewhere everything stays in the browser.

## Style

- Formatting and lint: Biome (`npm run check`, `npm run format`). Types: TypeScript checks the JSDoc (`checkJs`), nothing is compiled. Add JSDoc where a shape is not obvious, as in `calc.js`.
- Names say what things are, in full English words. Comments say why, not what.

## Saved data

- Offers and settings live in `localStorage` (keys in `KEY`, in `state.js`), in backup files and in the Claude account document `data/users/<id>/estado`. Never change a storage key or the document path: people would lose their offers.
- Renaming a saved field or value breaks existing data. If you have to, map the old name in `legacy.js`, as is done for the Spanish names used before October 2026, and add a case to `tests/test_legacy.py`.

## Legal figures

- Every legal or tax figure lives in `src/law.js`, with its source: minimum wage per year, working time, rest, vacation, severance, the overnight bonus, Social Security rates, unemployment benefit and IRPF. Code and texts read it from there (`LAW`, `minWageOf`, `SOCIAL_SECURITY`, `citeOf`); do not hard-code a legal figure anywhere else.
- Figures inside the HTML text are `<span data-law="key">` placeholders filled by `views/law-figures.js`; links to sources are `<a data-source="et" data-art="38">`.
- Each January, add the new minimum wage to `MIN_WAGE` and review the rest of `law.js`. `test/law.test.js` fails once the current year is missing.

## Figures

- The model in `model/` follows Spanish labour law (sources in the Leyes tab). Fix display problems in the display code; do not bend the maths to make a figure look right.
- Every ledger on the page must add up on screen: a row with «=» has to come out of the rows above it, with the same rounding that is shown. `tests/test_consistency.py` checks this for every sample offer.

## Checking changes

- `npm run check` and `npm run test:unit` (Node), then `uv run pytest` (headless Chromium; first time: `uv run playwright install chromium`). CI runs all of them on every push.
- The page is mobile-first: look at it at 375 px wide, in light and dark mode.

## Commits

- No `Co-Authored-By` or `Claude-Session` trailers.
