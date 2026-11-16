# ADR-0035: Treat an offer and what happened as one job with an agreed side and a happened side that defaults to it, instead of a record laid over an offer or two separate objects

Status: Accepted (owner, 15 November 2026; implementation details left to the main agent)
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

## Owner's decisions (15 November 2026)

- The tab is «Trabajos»; «Sí, todo» means what was agreed was received; days per month as counts besides a total; year headers as one sum marked «≈»; lapsed old jobs grey and «prescrito»; «Año a año» leaves Comparar.
- Entering data must be lax: few required fields. The uses to support: an offer that is then worked and recorded, compared condition against condition (offered and realised); a past job remembered only by its conditions, taken as they were; a past job remembered only by what happened (days, what was paid in total or per month), with no solid offer behind it. No detailed record of days or cobros is ever required for a past job.
- Hours are not required in the quick entry (this replaces the design's recommendation): without them, nothing about hours is judged.
- The value of a vacation day is what a day of the job is worth (cash included), though a legal claim may only reach the payroll's part.
- Where an agreement's salary is below the minimum wage, the agreement is out of date and the minimum wage is the base (the overnight bonus).

## Notes from phase A (15 November 2026)

- «Computed once per paint» is a memo (`calcOffer`, `settleOffer` in `state.js`) reset on save, on load and at the start of each paint.
- `model/days.js` holds only what was duplicated (`daysBetween`, `monthDays`, `monthSpan`); the month share and spreading a total arrive with phase B.
- The claim, talk and dossier contexts stay in `ui/record.js`: they build text from `claim-text.js`, above the model layer.

## Notes from phase B (15 November 2026)

- Format 8 in `mine.record`: `paid?: 'asAgreed' | 'none'` (absent: the cobros speak), a month holds either `days` or `count: { work, off, sick }`, a cobro may carry `approx: true`. `monthFacts` in `model/days.js` is the one reader of both day encodings.
- `paid` wins over the cobros, and adding a cobro clears it.
- A job's figures are real (`actualFigures`) once it is finished and its record is complete; a job entered by totals has counted months nobody closes, so closed months are not required.
- Under «Sí, todo» what the law requires beyond the agreement (a severance the offer did not mention, pay below the minimum) still shows as Falta, labelled as the legal minimum.

## Notes from phase C (16 November 2026)

- For a job that has begun, `missing(terms, today)` asks only its duration; an offer still to start keeps asking hours, pay and vacation, which matter to compare it.
- A finished job with no facts and no answer is bare (`isBare` in `job-view.js`): the ficha leads with the analysis and asks «¿Se cobró este trabajo?».
- The Registro and «Trabajo ya hecho» are pages over the ficha, each with a history entry. «Trabajo ya hecho» needs only the first and last day; a total cobrado becomes one cobro on the last day.
- The list is amber only while a claim deadline runs; «Sin registro» and «Prescrito» are grey. «Año a año» and `yearMoney` are gone.

## Notes from the owner's first use (16 November 2026)

- The question about what was paid answers «Todo lo pactado», «Una parte» or «Nada»; «Una parte» opens the cobro sheet at once, which can add several in a row. Cobros live on the ficha of any job that has them, not on the Registro page. «Trabajo ya hecho» takes a list of cobros instead of one total.
- A job without a contract is asked about vacation too: taken or paid apart owes nothing; «dentro del pago» still owes it, since a job measured as fijo cannot fold vacation into the pay (ET 38.1).
