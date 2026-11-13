# ADR-0032: Record what happened as facts closed month by month in the offer's mine, and settle them in a pure function, instead of deriving days from the offer or keeping one running total

Status: Accepted
Date: 2026-11-12

## Context

Until 12 November 2026 the page held only what was promised (`terms`) and what should have been paid (the model, with a simulated payslip in «Final de campaña»). Nothing recorded what happened: which days were worked or off, and what was paid, when and how. The owner, using the page at the end of a job, found the missing half: «me han pagado esto en nómina, esto en mano, entonces me falta tanto».

The model counts in averages (a 30-day month, `workFrac`), so no day exists in it, and a rule such as «4 days off a month» does not say which.

Weighed and discarded:
- Everything by day, every day recorded: exact, but nothing works until the whole calendar is filled in.
- Only the exceptions to a base derived from the offer: light, but changing the offer later would rewrite what the shepherd had recorded. The owner rejected it: what is defined for a month is the fact, whatever the offer says afterwards.
- One running total of what is owed: it hides which months are unpaid, and the claim lapses a year after each one (ET art. 59.2).

## Decision

- An offer stays the promise. What happened is a record kept in `mine.record`, in the same row, never shared (ADR-0007). It holds days and payments only; hours are left out of the first version.
- A month is either «according to the offer» or closed. Closing it freezes every day of the month as the shepherd left it (worked, off, sick, vacation); after that the offer cannot change it, and reopening is an explicit act. In an open month a day the shepherd touched is already a fact, and the rest follows the offer, as an estimate marked as such. A payment is `{ id, date, amount, via, note }`, with `via` payroll, cash or transfer.
- `settle(offer, record, today)` is a pure function in `model/`, with no DOM. Per month and per item (salary, overnight bonus, vacation), as ADR-0004 requires, it takes what is due from the real days of a closed month, or from the model's averages for an open one, and what was received. Payments are assigned to the oldest unpaid month first. The figure owed is, per item and month, the greater of what was agreed and what the law's minimum requires; what was received in cash is reported apart, as pay that contributed nothing. Each unpaid month carries its claim deadline.
- With an empty record `settle` gives the figures the ficha already shows. This is the test that keeps the two models from drifting.
- The phase of an offer comes from its dates, not from a mode the shepherd picks: undecided (no start date or one in the future), under way, finished; an offer marked «solo oferta» is never worked. The ficha is one page whose top block changes with the phase.
- The saved format goes to version 5 (ADR-0023): a migration gives every `offer_mine.mine` an empty `record`, with `upgrade[5]` and a fixture for browser copies and backups.
- The calendar's pre-marking of days off is a default of the screen, not a rule of the model: it decides nothing until the month is closed.

## Consequences

- The shepherd's own data becomes the most sensitive thing the page keeps. It stays in `mine`; any aggregate of it across shepherds (what is paid against what was agreed) needs its own consent and its own record.
- Two sources of days coexist (the model's averages for open months, frozen days for closed ones), and `settle` has to reconcile them; a month with a few touched days is the awkward case.
- Assigning payments to the oldest month first can differ from what the employer meant by a payment; a field saying which month a payment covers can be added later without changing the format's shape.
- The account sync writes the whole offer on each change, so a long job grows its row: a few hundred days and payments at most, which is small.
- The ficha, the cards in Ofertas and the name of the Ofertas tab will have to say which phase an offer is in; «oferta» stays the name of the thing for now.

## Corrections

12 November 2026: the Decision said cash is reported apart «as pay that contributed nothing». That read as if cash did not count against what is owed. It does: cash is money received and reduces what is owed, as ADR-0004 and `docs/model.md` («What is owed») already say. What it does not do is contribute to Social Security, so a payroll below the minimum stays flagged on its own. The decision is as ADR-0004 had it; only the wording here was wrong.

## Amendments

12 November 2026, after the first mock-ups, before any interface existed. The owner decided:
- A day in the record is `work`, `off` or `sick`. A libranza and a vacation day are the same mark, `off`; the vacation owed comes from the offer's terms, not from day marks. This replaces «worked, off, sick, vacation» in the Decision.
- A payment is recorded net: what actually arrived. It is grossed up for the comparison with what is due, as the model already does for cash.
- A month cannot be closed without its calendar having been shown: closing happens from the calendar or from a month-by-month review, never in bulk and blind.
- An offer with no known end gets its months from the start date up to today.
- What differs from the offer in a month is judged by counts (worked days, days off), not day by day: moving a libranza from one day to another is not a difference.

13 November 2026, after the first real use. The owner decided:
- The record works with totals: what matters at the end is Corresponde against Cobrado. Payments are a free list that does not cover months; the oldest-first assignment only dates the claim, and the months remain only for days.
- The real period of a job follows what is marked in the calendar, not dates kept in the record: a month after the offer's last one joins the job if a day is marked worked in it, and in a closed month the days off before the first or after the last worked day lie outside the job. The saved format does not change.
- The phase of a job follows its real end, the later of the offer's end and the last worked day.
