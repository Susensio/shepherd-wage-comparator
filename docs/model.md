# What the model means

The code in `src/model/` is the exact version, and `src/law.js` holds every legal figure with its source. This page keeps only what the code cannot say by itself: what the figures mean and the rules that cross files.

## The offer

- An offer is `{ id, terms, mine }` (ADR-0007), plus `cmp`, the Comparar toggle, which is a view choice and stays at the top.
- `terms` is what the employer offers and the only part ever shared: dates, duration, hours, days off, contract, pay, extra pays, vacation, cash, agreed total, overnight, housing, meals given, the km rate paid, where the job is (INE municipality code and province code) and the herd (head counts of sheep, goats and cattle). `DEF_TERMS` in `src/offer.js` lists them.
- `mine` is the worker's own figures for that offer: `name`, the village (`place`), whether it was only an offer and never worked (`offerOnly`, ADR-0017), distance and trips, car, commute, other expenses, the rent override and the IRPF choice. `DEF_MINE` lists them. A field belongs to exactly one of the two.
- Whatever the employer's terms alone decide (schedule, legal minimum, the questions in `offer.js`) takes `terms`; only the car, the other expenses, the rent and the IRPF choice read `mine`.
- `vacationAuto` (vacation set for a short contract, not by the user) sits in `terms` with `vacation`.

## Terms-only figures

- `calcTermsOnly` (`model/calc.js`) calculates an offer from `terms` alone, with `termsOnly` (`offer.js`): a neutral `mine` (no car, so no trips, km or fuel; no other expenses; no rent override; automatic IRPF) and IRPF as if nothing else was earned that year (`others` 0, no other offers). It works from `{ id, terms }`, which is how other people's offers are calculated (ADR-0007).
- The rest of the settings are kept: what housing and meals are worth, Social Security rates. They value the terms; they say nothing about the worker's life. The km rate the employer pays is in `terms` but is paid per km driven at work, so with no km it is zero.
- These figures say what the job pays, not what it is worth to any one worker, so they leave out costs that differ between workers. The Comparar tab can show them for own offers (the «Solo las condiciones» switch).

## Other shepherds' offers

- Read only when signed in with sharing on, fetched on entering Comparar and on demand; the include switch is on by default while sharing, and kept in `state.others`, in memory. They are never put in `state.offers`, `localStorage`, backups or the account's own rows.
- They come through `ingestShared` (`saved.js`): defaults for missing fields, unknown ones never read, no `mine` but the sharer's name. Calculated with `calcTermsOnly` only; including them in the ranking forces terms-only on for every row, own ones too.
- The read-only view reuses `resultView` with `readOnly`: no editing, negotiating, copying or payslip controls.

## The account copy

- Signed in, the account is the source of truth and `localStorage` its cache (`storage/account.js`). Changes are written after a pause, and only the offers whose `terms`, `mine` or `cmp` changed.
- The first sign-in of a user on a browser uploads the offers the account lacks and keeps both sets, merged by id; ids that are not uuids get a new one first, in the browser too. Only a failed upload asks (ADR-0009). An empty account starts like a first visit, with the templates, and its placeholder offer is never written.
- Backups made before ADR-0007 hold flat offers; `ingestSaved` splits them by `DEF_MINE` (own figures) and puts the rest in `terms`. The browser's own storage of that time (`cj.ofertas`) is still not read.
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

- «Ganas» (`earnings.total`, `perHour`, `perDay`, `perMonth`, and the parts in `PARTS`) is money only: what reaches the worker, plus housing and food when counted, minus car and other expenses. The unemployment benefit a contribution generates is not part of it (ADR-0022): `r.unemployment` keeps its days and euros, shown apart under the headline. The old «Contar el paro que generas» setting is gone; `ingestSaved` drops a saved `unemployment` value.
- **Paro lost to money en negro** (`r.unemployment.lost`): the benefit that the declared pay plus the gross equivalent of the cash (`r.cash.grossEq`) would give, minus the benefit generated, over the same contributed days (a month when there is no duration). Without a contract, all of it. Zero when the declared pay already reaches the benefit's maximum, and without cash. Only the euros differ when there is a contract: the days contributed are the same.
- **Comparar's ranking key** is «Ganas» plus the paro, both in the chosen unit (`inUnit`); with «Solo lo que ganas» (not saved) it is «Ganas» alone. The sum is never shown. Offers without a duration, in «en total», go last. Medals, the chart over time and the yearly summary use money only.
- The law's figures (Social Security rates, overnight bonus, vacation days, annual hours) are read from `src/law.js`, not from the settings; values saved for them are dropped on load (`ingestSaved`).
- **Savings** is what the employer saves at the worker's expense, with their Social Security: the contributions on the cash part, the missing minimum, and the unpaid extra days and overtime. It is the worker's margin to negotiate.

## Agreed totals and net pay

- An agreed total is split into payroll and cash: the cash part is the total minus what reaches the worker on payroll, net, and never below zero.
- A net pay is turned into the gross that gives it, because IRPF depends on the gross. The same conversion says what gross would bring the cash part net.
- IRPF counts the worker's other worked offers in the same year. Those are calculated on their own to avoid circular references.

## Pay questions

The «Lo que te pagan» section of the form is a view over `terms`; it saves no fields of its own (`src/pay-answers.js`). The first amount is in `unit` (day, month, or total when the offer has a duration).

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
- Every ledger's «=» row is the sum of its rows as shown: rows are rounded first, then added, per column (`test/e2e/ledger.js` checks exact equality). A total can therefore differ by a cent or a euro from the same figure computed elsewhere. The headline «Ganas» is not one of those: it shows the breakdown's «Ganas» in its unit (`earnedShown` in `views/result.js`), so the two always match; Comparar's ranking still rounds the exact figure. The rule lives in `src/ledger.js` (cents, `sum`, `shownDiff`, `fSumE`, days to tenths below 10); views only format what it returns.
- Places: `data/places-<version>.json`, built by `npm run places` from GeoNames (ADR-0015), is fetched when an offer's form opens and kept in Cache Storage under its version; data saving or a 2G line defers it to the location field. `src/places.js` folds names and searches them; a municipality code is named through the list once it has arrived.
- Account sync keeps unsynced changes in `localStorage` (`cj.accountUnsynced`: changed and removed offer ids, settings), so offline edits survive a reload and are written first on the next connect; fingerprints are taken before each write. Signing out writes pending changes first, then clears the browser's copy, as does deleting the account (ADR-0017, ADR-0018).
- Shared rows: `ingestShared` fills the defaults and drops `offerOnly`; same-named sharers get a detail (place, then place or dates, then dates, then both, then «n.º N») from `sharedLabels` in `text.js`.
- The schema lives in `supabase/migrations/` (ADR-0016), applied in order by `test/unit/rls.test.js` and by `.github/workflows/db.yml`.
