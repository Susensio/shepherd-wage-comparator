# How an offer is calculated

`calc(offer, {cfg, offers})` in `src/model/calc.js` returns every figure of an offer, grouped by subject. Money is gross euros over the whole contract unless a name says otherwise. This page explains the rules behind it; the code is the exact version and `src/law.js` holds every legal figure with its source.

## Pipeline

1. **`effectiveOffer`** (`pay.js`) rewrites the offer into what is calculated: «use the minimum wage» becomes a payroll at the applicable minimum, and an agreed total becomes payroll plus a cash part (the total minus what reaches the worker on payroll, net; never below zero).
2. **`schedule`** (`time.js`): duration in payroll months, days worked, days off, vacation, hours.
3. **`payroll`** (`pay.js`): gross, Social Security, IRPF and net.
4. **`legalMinimum`** (`pay.js`): what the law requires for the same period.
5. **`calc`** puts them together: earnings, what is owed, extra time, what the employer saves.
6. **`monthlyPayslips`** (`payslips.js`) spreads the payroll over calendar months for a dated offer.

## Time

- Months are counted as on a payslip: whole calendar months from the start date, plus the leftover days at 1/30 (21 Jun – 30 Sep is 3.33 months). Without a date, a month is an average length.
- Vacation accrues at 2.5 days per month, rounded to whole days.
- The normal week is 40 h over 5.5 days, because the law requires a day and a half of weekly rest. The normal workday is the 40 h spread over the days worked, between 7.3 and 9 h.

## Pay

- The agreed pay can be per day, month, year or total, gross or net. A net figure is turned into the gross that gives it by bisection, because IRPF depends on the gross.
- IRPF is either entered by the worker or estimated from the year's income, counting the other worked offers. Those are calculated on their own (`alone`) to avoid circular references. Temporary contracts pay at least the fixed minimum withholding.
- A vacation day is the month's salary divided by 30, never below a day at the minimum wage.
- Without a contract there is no payroll: everything paid is cash, measured against a temporary contract's minimum, and the vacation is owed.

## What is owed

- Counted per item (salary, overnight bonus, vacation), month by month. A surplus in one item does not cover a shortfall in another (ADR-0004).
- Cash is subtracted from what is owed, but a payroll below the minimum is still illegal, because cash pays no Social Security. The gross that would bring the cash part net, on payroll, is `cash.grossEq`.
- Casual workers (temporary contracts up to `LAW.casualMaxDays`) are measured against the daily minimum, not the monthly one.

## Extra time

Two rules, and each extra hour counts once.

- **Extra days:** days worked above the due workdays (the contract's days minus weekly rest, public holidays and vacation taken). Each is valued as a normal workday at the minimum wage.
- **Overtime:** hours above the normal workday, on every day worked, valued at the minimum hourly wage.
- Whatever is paid above the legal minimum, on payroll and in cash, covers the extra days first and the overtime after.

## Earnings and the employer's side

- Earnings add net payroll, cash, housing and food in kind, kilometres paid, severance and the unemployment benefit the contribution generates, minus the car and other expenses. The benefit counts as the worker's money because a payroll gives it and cash does not; it can be switched off in the assumptions.
- **Savings** is what the employer saves at the worker's expense, with their Social Security: the contributions on the cash part, the missing minimum, and the unpaid extra days and overtime. It is the worker's margin to negotiate.

## Showing the figures

The maths follows the law; display problems are fixed in the views. Every ledger with «=» has to add up on screen with the rounding shown, which `test/e2e/consistency.spec.js` checks for every sample offer (`extraDaysRounded` exists for that).
