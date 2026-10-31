# Shepherd Wage Comparator

A page for shepherds in Spain to compare job offers. It checks each offer against the legal minimum wage, the night-stay bonus, holidays, weekly rest and the 40-hour week, and shows what is left unpaid, both on the payslip and in cash.

Live at **https://susensio.github.io/shepherd-wage-comparator/**. The interface is in Spanish.

## How it works

HTML, CSS and JavaScript modules, with no build step. The libraries are [lit-html](https://lit.dev/docs/libraries/standalone-templates/) and, for optional accounts, [supabase-js](https://supabase.com/docs/reference/javascript), both copied into `vendor/`. Offers are saved in the browser (`localStorage`) and, with an optional account (Google sign-in, on [Supabase](https://supabase.com)), in that account, from where a shepherd can share them with others who share too.

How the figures are calculated is in [docs/model.md](docs/model.md); why the project is built this way is in [docs/adr/](docs/adr/).

The page has to be served over http (modules do not load from `file://`):

```
node test/serve.js
```

and open http://localhost:8000. Any static server works (`python3 -m http.server` too).

`index.html` holds the static markup and `src/` the code, with the calculations in `src/model/` and every legal figure in `src/law.js`. `vendor/` has lit-html (BSD-3-Clause) and supabase-js (MIT) as published. Unit tests are in `test/unit/`, browser tests in `test/e2e/`.

## Development

```
npm ci
npx playwright install chromium   # once
npm run check                      # format, lint and type-check (JSDoc)
npm run format                     # fix formatting
npm test                           # unit tests, then the browser tests
npx playwright test --ui           # the browser tests, watching them run
```

The tests cover the calculations, that every figure on the page adds up, the main flows and saving and loading data.

The figures are estimates and are not legal advice.
