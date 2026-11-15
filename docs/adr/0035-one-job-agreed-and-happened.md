# ADR-0035: Treat an offer and what happened as one job with an agreed side and a happened side that defaults to it, instead of a record laid over an offer or two separate objects

Status: Proposed (main agent, 15 November 2026, from the owner's idea and a design agent; the owner decides)
Date: 2026-11-15
Amends: ADR-0032, ADR-0034, ADR-0030, ADR-0020

## Context

On 15 November 2026 the owner observed that an offer and a record are the same thing, one a promise about the future and the other a fact about the past. Entering an old job meant entering an offer and then correcting it with a record, and comparing used the promise where the outcome was wanted. Three reviews of commit db37744 pointed the same way. Usability: a finished job without a record opened on empty accounts, «No se cobró nada» was one tap from a large debt, and old jobs nagged in amber. Architecture: rules had several owners (the job's end, «worked», day counts, the month share) and the model ran about 150 computations per paint. Union: severance and accrued vacation must be facts of what happened.

Weighed and discarded:
- Two objects, an offer and a job, linked: a conversion step and duplicated terms.
- Only what happened, dropping what was agreed: what is owed needs the agreed pay (owed = the greater of agreed and minimum, minus what was received; ADR-0004).
- Keeping the overlay as it was: the problems above.

## Decision

- One object, «trabajo»: `terms` is what was agreed (shared, unchanged); `mine.record` is what happened (private). Each part of what happened defaults to what was agreed: the dates, the days of each month, and the money once «Sí, todo» is answered to «¿Se cobró este trabajo?».
- A month's days are kept per day or per month as counts; a total for the job is spread into month counts when entered. A cobro may be a lump marked approximate. `record.paid` is `asAgreed` or `none` (replacing `nothingPaid`).
- «Trabajo ya hecho» enters a finished job on one screen with its record closed.
- Comparar ranks real figures for worked jobs with a complete record and agreed figures for the rest, each labelled. Nothing of what happened is shared with other shepherds; an aggregate needs its own consent and ADR.
- The ficha follows the job's state (offer, under way, finished without record, finished with record); the record is a page of its own.
- One owner per rule: `model/phase.js` (worked, start, end, phase, facts), `model/days.js` (the days of a month and the month share), `settle` taking the offer's figures instead of computing them, a pure view-model module, and the figures of each job computed once per paint.
- Saved format 8, `min_page_version` 7.

## Consequences

- An old job takes under a minute; a finished job without a record is calm and leads with the analysis.
- «Oferta» names only a job not started or never taken; the tab may become «Trabajos».
- Two encodings of days exist; one module reads both.
- Weekly rest cannot be judged on months kept as counts, and the screen says so.
- `min_page_version` 7 makes open old tabs reload.
