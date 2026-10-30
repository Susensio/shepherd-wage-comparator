# AGENTS.md

Notes for anyone (person or agent) changing this code. The README says what the page is; this file says how to work on it.

## Language

- Code is in English: identifiers, comments, CSS classes, ids, data attributes, saved field names, commit messages.
- What the user sees is in Spanish (Spain). The page speaks to the reader as «tú», in the imperative when it asks for something ("Apunta", "Compara"). It never talks about itself: what the page does goes in the impersonal «se» ("Se rellenan…"), never as a verb that could be read as an order to the reader. Concise, neutral tone: no first person, no colloquialisms (no «tocan», «al banco»), no «gratis». «En mano» and «en negro» are fine for undeclared pay.

## Structure

- No build step and no dependencies. `index.html` loads `css/styles.css` and the files in `js/` as classic scripts (`defer`), in the order listed there. They share one global scope, so a file can use what an earlier one declares; top-level code can only use what is already loaded.
- No ES modules on purpose: the page must also open from disk (`file://`), where modules do not load.
- Rough map: `law.js` (legal and tax figures) → `constants.js` (units, defaults) → `utils.js` → `legacy.js` → `state.js` → `model.js` (`calc()`, no DOM) → `text.js` → `render-*.js` → `ui.js` → `events.js` → `backup.js` → `cloud.js` → `tooltips.js` → `laws-tab.js` → `main.js`.
- The same files are published as a Claude artifact. Saving to the user's Claude account (`cloud.js`, `window.claude`) only works there; elsewhere everything stays in the browser.

## Saved data

- Offers and settings live in `localStorage` (keys in `KEY`, in `constants.js`), in backup files and in the Claude account document `data/users/<id>/estado`. Never change a storage key or the document path: people would lose their offers.
- Renaming a saved field or value breaks existing data. If you have to, map the old name in `legacy.js`, as is done for the Spanish names used before October 2026, and add a case to `tests/test_legacy.py`.

## Legal figures

- Every legal or tax figure lives in `js/law.js`, with its source: minimum wage per year, working time, rest, vacation, severance, the overnight bonus, Social Security rates, unemployment benefit and IRPF. Code and texts read it from there (`LAW`, `SMI`, `SOCIAL_SECURITY`, `citeOf`); do not hard-code a legal figure anywhere else.
- Figures inside the HTML text are `<span data-law="key">` placeholders filled by `laws-tab.js`; links to sources are `<a data-source="et" data-art="38">`.
- Each January, add the new minimum wage to `MIN_WAGE` and review the rest of `law.js`. `tests/test_law.py` fails once the current year is missing.

## Figures

- The model in `model.js` follows Spanish labour law (sources in the Leyes tab). Fix display problems in the display code; do not bend the maths to make a figure look right.
- Every ledger on the page must add up on screen: a row with «=» has to come out of the rows above it, with the same rounding that is shown. `tests/test_consistency.py` checks this for every sample offer.

## Checking changes

- `uv run pytest` runs everything in headless Chromium (first time: `uv run playwright install chromium`). CI runs the same on every push.
- The page is mobile-first: look at it at 375 px wide, in light and dark mode.

## Commits

- No `Co-Authored-By` or `Claude-Session` trailers.
