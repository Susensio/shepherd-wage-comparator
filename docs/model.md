# What the model means

The code in `src/model/` is the exact version, and `src/law.js` holds every legal figure with its source. This page keeps only what the code cannot say by itself: what the figures mean and the rules that cross files.

## The offer

- An offer is `{ id, terms, mine }` (ADR-0007), plus `cmp`, the Comparar toggle, which is a view choice and stays at the top.
- `terms` is what the employer offers and the only part ever shared: dates, duration, hours, days off, contract, pay, extra pays, vacation, cash, agreed total, overnight, housing, meals given, the km rate paid, where the job is (the village `place`, INE municipality code and province code), whether it was only an offer and never worked (`offerOnly`) (both since schema version 3, ADR-0028) and the herd (head counts of sheep, goats and cattle). `DEF_TERMS` in `src/offer.js` lists them.
- `mine` is the worker's own figures for that offer: `name`, distance and trips, car, commute, other expenses, the rent override and the IRPF choice. `DEF_MINE` lists them. A field belongs to exactly one of the two.
- Whatever the employer's terms alone decide (schedule, legal minimum, the questions in `offer.js`) takes `terms`; only the car, the other expenses, the rent and the IRPF choice read `mine`.
- `vacationAuto` (vacation set for a short contract, not by the user) sits in `terms` with `vacation`.

## Terms-only figures

- `calcTermsOnly` (`model/calc.js`) calculates an offer from `terms` alone, with `termsOnly` (`offer.js`): a neutral `mine` (no car, so no trips, km or fuel; no other expenses; no rent override; automatic IRPF) and IRPF as if nothing else was earned that year (`others` 0, no other offers). It works from `{ id, terms }`, which is how other people's offers are calculated (ADR-0007).
- The rest of the settings are kept: what housing and meals are worth, Social Security rates. They value the terms; they say nothing about the worker's life. The km rate the employer pays is in `terms` but is paid per km driven at work, so with no km it is zero.
- These figures say what the job pays, not what it is worth to any one worker, so they leave out costs that differ between workers. The Comparar tab can show them for own offers (the «Solo las condiciones» switch).

## Other shepherds' offers

- Read only when signed in with sharing on, fetched on entering Comparar and on demand; the include switch is on by default while sharing, and kept in `state.others`, in memory. They are never put in `state.offers`, `localStorage`, backups or the account's own rows.
- They come through `ingestShared` (`schema.js`): defaults for missing fields, unknown ones kept at the current version and dropped from a newer one, no `mine` but the sharer's name. Calculated with `calcTermsOnly` only; including them in the ranking forces terms-only on for every row, own ones too.
- The read-only view reuses `resultView` with `readOnly`: no editing, negotiating, copying or payslip controls.

## The account copy

- Signed in, the account is the source of truth and `localStorage` its cache (`storage/account.js`). Changes are written after a pause, and only the offers whose `terms`, `mine` or `cmp` changed.
- The first sign-in of a user on a browser uploads the offers the account lacks and keeps both sets, merged by id; ids that are not uuids get a new one first, in the browser too. Only a failed upload asks (ADR-0009). An empty account starts like a first visit, with the templates, and its placeholder offer is never written.
- Backups made before ADR-0007 hold flat offers; the version 1 upgrader (see «Saved format») splits them by `DEF_MINE` (own figures) and puts the rest in `terms`. The browser's own storage of that time (`cj.ofertas`) is still not read.
- A browser that has synced with that user before takes the account's copy as it is: an offer missing from the account was deleted on another device, except what was changed here and not yet written: offline edits, and edits made between opening the page and the account connecting. From the start of a visit with a saved session (`trackUntilConnected`, before the bundle loads), changes go into the same unsynced record (`UNSYNCED_KEY`) as offline ones, and the account's copy keeps them: edited and new offers stay, deleted ones stay deleted, settings stay.
- While a saved session connects, the page shows the cached copy, the account button «connecting» and «Cargando tu cuenta…», never a guest's sign-in; if connecting fails, it falls back to guest with «No se pudo conectar con la cuenta.».
- The blank placeholder offer of a first visit is never written.

## What is owed

- Counted per item (salary, overnight bonus, vacation) and month by month. A surplus in one item does not cover a shortfall in another (ADR-0004).
- Cash is subtracted from what is owed, but a payroll below the minimum is still illegal, because cash pays no Social Security.
- Without a contract there is no payroll: everything paid is cash, measured against a temporary contract's minimum, and the vacation is owed.

## Extra time

Two rules, and each extra hour counts once.

- **Paid days:** a wage «al día» is paid for the whole days worked (`daysWorked`, rounded) plus the public holidays and vacation taken off, which are paid too (`paidDays` in `model/time.js`). With nothing taken off, pay per day worked is exactly the daily wage.
- **Extra days:** days worked above the due workdays (the contract's days minus weekly rest, public holidays and vacation taken). Each is valued as a normal workday at the minimum wage.
- **Overtime:** hours above the normal workday, on every day worked, valued at the minimum hourly wage.
- Whatever is paid above the legal minimum, on payroll and in cash, covers the extra days first and the overtime after.

## Earnings and savings

- «Se gana» (`earnings.total`, `perHour`, `perDay`, `perMonth`, and the parts in `PARTS`) is money only: what reaches the worker, plus housing and food when counted, minus car and other expenses. The unemployment benefit a contribution generates is not part of it (ADR-0022): `r.unemployment` keeps its days and euros, shown apart under the headline. The old «Contar el paro que generas» setting is gone; `ingestSaved` drops a saved `unemployment` value.
- **Paro lost to money en negro** (`r.unemployment.lost`): the benefit that the declared pay plus the gross equivalent of the cash (`r.cash.grossEq`) would give, minus the benefit generated, over the same contributed days (a month when there is no duration). Without a contract, all of it. Zero when the declared pay already reaches the benefit's maximum, and without cash. Only the euros differ when there is a contract: the days contributed are the same.
- **Comparar's ranking key** is «Se gana» plus the paro, both in the chosen unit (`inUnit`); with «Solo lo que se gana» (not saved) it is «Se gana» alone. The sum is never shown. Offers without a duration, in «en total», go last. Medals, the chart over time and the yearly summary use money only.
- The law's figures (Social Security rates, overnight bonus, vacation days, annual hours) are read from `src/law.js`, not from the settings; values saved for them are dropped on load (`ingestSaved`).
- **Savings** is what the employer saves at the worker's expense, with their Social Security: the contributions on the cash part, the missing minimum, and the unpaid extra days and overtime. It is the worker's margin to negotiate.

## Agreed totals and net pay

- An agreed total is split into payroll and cash: the cash part is the total minus what reaches the worker on payroll, net, and never below zero.
- A net pay is turned into the gross that gives it, because IRPF depends on the gross. The same conversion says what gross would bring the cash part net.
- IRPF counts the worker's other worked offers in the same year. Those are calculated on their own to avoid circular references.

## Pay questions

The «Pago» section of the form is a view over `terms`; it saves no fields of its own (`src/pay-answers.js`). The first amount is in `unit` (day, month, or total when the offer has a duration).

| Answer | Fields |
|---|---|
| Todo | `payrollMin: false`, `payType: 'net'`, `payAmount` and `payUnit` = amount and unit, `cashMode: 'amount'`, `cashAmount: ''` |
| El mínimo (el salario mínimo) | `payrollMin: true`, `cashMode: 'total'`, `totalAmount` and `totalUnit` = amount and unit |
| Una parte | `payrollMin: false`, `payAmount` = the part, `payType` net or gross, `payUnit` = unit, `cashMode: 'total'`, `totalAmount` and `totalUnit` = amount and unit |
| Sin contrato | `contract: 'none'`, `cashAmount` and `cashUnit` = amount and unit |

En negro is never asked: it is the model's `split.cash`. «Una parte» without the part is missing (`payrollPart`), as the model would take all of it as en negro. The vacation answers are `terms.vacation`; «Las libro» is hidden when `vacationPayable`: the contract is casual (`isCasual`: temporary, `natDays` of the schedule up to `LAW.casualMaxDays`) or lasts a month or less of any kind (`isShortContract`), the cases where the vacation may be paid instead of taken. The same rule decides whether paying it is legal in `rights.js`, so an option the form hides is never the one the verdict asks for. It does not change the default `defaultVacation` sets (only a month or less); an offer that already has «Las libro» keeps it, with a hint.

Shapes the answers cannot say are converted once, in `ingestSaved` (every load path), by `toAnswerable`: a yearly amount becomes monthly, «total» without a duration becomes a month, and a payslip with en negro money, or a part whose unit differs from the total's, becomes «Una parte» with total = net payslip + en negro in the payslip's unit. A conversion is kept only if the earnings, gross, net, cash and debt figures stay within a cent. The exception is a net payslip with en negro money and vacation inside the pay: with a total the model puts the vacation on top of the payslip, so both amounts are kept and only that treatment of the vacation moves.

## Rules added in November 2026

- Social Security rates depend on the contract: `ssOf(contract)` in `law.js` (Orden PJC/297/2026), read through `r.pay.rates`. An offer without a contract uses the fijo discontinuo rates, the most common contract in shepherding, to turn cash into gross and to price what the employer saves (owner, 1 November 2026).
- Every ledger's «=» row is the sum of its rows as shown: rows are rounded first, then added, per column (`test/e2e/ledger.js` checks exact equality). A total can therefore differ by a cent or a euro from the same figure computed elsewhere. «Ganado» is not one of those: the headline, Comparar (ranking and head to head) and the share card show the breakdown's sum in their unit (`earnedShown` in `units.js`, with the columns' rounding `shownInColumns`), so they always match; only units the breakdown has no column for (per hour) round the exact figure. The rule lives in `src/ledger.js` (cents, `sum`, `shownDiff`, `fSumE`, days to tenths below 10); views only format what it returns.
- Places: `data/places-<version>.json`, built by `npm run places` from GeoNames (ADR-0015), is fetched when an offer's form opens and kept in Cache Storage under its version; data saving or a 2G line defers it to the location field. `src/places.js` folds names and searches them; a municipality code is named through the list once it has arrived.
- Account sync keeps unsynced changes in `localStorage` (`cj.accountUnsynced`: changed and removed offer ids, settings), so offline edits survive a reload and are written first on the next connect; fingerprints are taken before each write. Signing out writes pending changes first, then clears the browser's copy, as does deleting the account (ADR-0017, ADR-0018).
- Shared rows: `ingestShared` fills the defaults; same-named sharers get a detail (place, then place or dates, then dates, then both, then «n.º N») from `sharedLabels` in `text.js`.
- The schema lives in `supabase/migrations/` (ADR-0016), applied in order by `test/unit/rls.test.js` and by `.github/workflows/db.yml`.

## Saved format and the version gate

- `src/schema.js` owns the saved format. `SCHEMA_VERSION` (4) is what is written to the account's `offers.schema_version` and to backups (`schema_version` beside `offers` and `cfg`). `upgrade[n]` turns version n into n + 1 (`offer` and `cfg`, each optional). Version 1: offers with every field at the top level, settings still holding former law figures. Version 2: `{ id, cmp, terms, mine }` and settings without them. Version 3: `offerOnly` and `place` in `terms` (ADR-0028; migration `20261104120000_offer_only_and_village_in_terms.sql`, `PAGE_VERSION` 2). Version 4: `contract: 'selfEmployed'` and `terms.vatIncluded` (ADR-0029; migration `20261105090000_self_employed.sql`, `PAGE_VERSION` 3). Fixture bundles per version are in `test/fixtures/schema/`, one test per upgrader in `test/unit/schema.test.js`.
- Every load path goes through it: `ingestSaved` (localStorage, backup file, account's own rows) and `ingestShared` (other shepherds' rows). An offer's version is its own `schema_version` (account rows), else its bundle's (backups), else its shape (browser copies were never stamped). Settings have no stamp in the account: they are treated as version 1, and their upgraders are idempotent.
- Writes are always the current version and keep fields the page does not know (`normalizeOffer` spreads them). A row of a newer version is read without its unknown fields, keeps its `schema_version` in memory and in the browser copy, and the account never writes it (`writable` in `storage/account.js`); a row of an older version is rewritten in the current one on connect.
- Browser copies have no stamp and read as version 2; `upgrade[2]` leaves an offer already in version 3 as it is, so that is harmless. For version 2, `mine.offerOnly` wins over a stale `terms.offerOnly` left from before ADR-0017.
- A new version needs: a batch migration that rewrites the rows and bumps `schema_version`, an `upgrade[n]` entry and fixture, and a higher `PAGE_VERSION` with `min_page_version` raised in the same migration when older pages could write the old shape.
- Version gate: `app_meta.min_page_version` (migration `20261104000000_min_page_version.sql`; a one-row table that anon and signed-in users can read and no API role can write) is the oldest page the database accepts. `PAGE_VERSION` in `schema.js`, raised by hand, is this page's. `storage/account.js` reads it on connect and before each flush that has something to write. A page below it stops syncing, reads nothing into the browser, sets the status `outdated` («Hay una versión nueva. Recarga la página.» on the account page and its button) and keeps recording its unsynced changes for after the reload (including the edits made before the account connected); signing out is refused while any are recorded, because it would clear them. A reconnect that finds the minimum lowered syncs again. A project without the `app_meta` table sets no minimum, so the page can ship before the migration is pushed.

## Self-employed (autónomo)

- Entered as the pay answer «Nada: se factura como autónomo» (`contract: 'selfEmployed'`); `payAmount` per `payUnit` is what is invoiced (per day: each day worked), with the IVA inside if `vatIncluded` (ADR-0029).
- `model/self-employed.js`: invoiced = agreed, less the IVA (10 %) if inside. Módulos income («rendimiento neto previo») = invoiced × 0,37. RETA tramo: that income less 7 % generic expenses, divided by the months registered (one without a duration); the quota is the tramo's minimum base × 31,50 % for each month. IRPF: on the módulos income less 5 %, the difference it makes to the year's tax on top of other offers' payslips (`irpfWithActivity`; above 6.500 € of activity income the earned-income reduction of those payslips goes, LIRPF art. 20). What is withheld on invoices (2 %) is shown, not counted.
- In `calc`, a self-employed offer has no payslip (like «sin contrato»), no paro, severance, debts, savings or unpaid time; `parts.invoice` is what is invoiced and the quota and IRPF are taken off what is earned (`deductionsOf` in `units.js`, shared by the breakdown and `earnedShown`). `r.selfEmployed` holds every step.
- Limits: no en negro beside the invoice; other offers' IRPF ignores the autónomo's income; one activity; the quota at the tramo's minimum base; one tramo for a contract spanning two years.
