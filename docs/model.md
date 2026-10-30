# What the model means

The code in `src/model/` is the exact version, and `src/law.js` holds every legal figure with its source. This page keeps only what the code cannot say by itself: what the figures mean and the rules that cross files.

## What is owed

- Counted per item (salary, overnight bonus, vacation) and month by month. A surplus in one item does not cover a shortfall in another (ADR-0004).
- Cash is subtracted from what is owed, but a payroll below the minimum is still illegal, because cash pays no Social Security.
- Without a contract there is no payroll: everything paid is cash, measured against a temporary contract's minimum, and the vacation is owed.

## Extra time

Two rules, and each extra hour counts once.

- **Extra days:** days worked above the due workdays (the contract's days minus weekly rest, public holidays and vacation taken). Each is valued as a normal workday at the minimum wage.
- **Overtime:** hours above the normal workday, on every day worked, valued at the minimum hourly wage.
- Whatever is paid above the legal minimum, on payroll and in cash, covers the extra days first and the overtime after.

## Earnings and savings

- The unemployment benefit a contribution generates counts as the worker's money, because a payroll gives it and cash does not. It can be switched off in the assumptions.
- **Savings** is what the employer saves at the worker's expense, with their Social Security: the contributions on the cash part, the missing minimum, and the unpaid extra days and overtime. It is the worker's margin to negotiate.

## Agreed totals and net pay

- An agreed total is split into payroll and cash: the cash part is the total minus what reaches the worker on payroll, net, and never below zero.
- A net pay is turned into the gross that gives it, because IRPF depends on the gross. The same conversion says what gross would bring the cash part net.
- IRPF counts the worker's other worked offers in the same year. Those are calculated on their own to avoid circular references.
