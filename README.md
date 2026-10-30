# Shepherd Wage Comparator

A page for shepherds in Spain to compare job offers. It checks each offer against the legal minimum wage, the night-stay bonus, holidays, weekly rest and the 40-hour week, and shows what is left unpaid, both on the payslip and in cash.

Live at **https://susensio.github.io/shepherd-wage-comparator/**. The interface is in Spanish.

## How it works

HTML, CSS and JavaScript modules, with no build step. The only library is [lit-html](https://lit.dev/docs/libraries/standalone-templates/), copied into `vendor/`. Offers are saved in the browser (`localStorage`). When the page runs as a Claude artifact, it also syncs to the user's Claude account.

How the figures are calculated is in [docs/model.md](docs/model.md); why the project is built this way is in [docs/adr/](docs/adr/).

The page has to be served over http (modules do not load from `file://`):

```
node test/serve.js
```

and open http://localhost:8000. Any static server works (`python3 -m http.server` too).

```
index.html        the static markup: the form, the Leyes tab, Ajustes
css/styles.css
src/
  law.js          every legal and tax figure, with its source
  offer.js        what an offer is: defaults, templates, dates
  model/          the calculations (calc.js), with no DOM
  rights.js       right by right, whether an offer complies
  text.js         summaries and the texts people copy
  views/          lit-html templates for each part of the page
  ui/             DOM helpers, motion, tooltips, folds
  storage/        backups and the Claude account
  app.js          paints everything from the state
  events.js       what each button and field does
  main.js         startup
vendor/lit-html/  lit-html, as published (BSD-3-Clause)
test/unit/        the model and the legal data, in Node (node --test)
test/e2e/         the page in headless Chromium (Playwright Test)
test/fixtures/    sample offers, today's format and the Spanish-era one
```

## Development

```
npm ci
npx playwright install chromium   # once
npm run check                      # format, lint and type-check (JSDoc)
npm run format                     # fix formatting
npm test                           # unit tests, then the browser tests
npx playwright test --ui           # the browser tests, watching them run
```

The tests cover the calculations, that every figure on the page adds up, the main flows and loading data saved by older versions.

The figures are estimates and are not legal advice.
