# ADR-0007: Split each offer into the employer's terms and the shepherd's own figures, instead of a flat offer split by a field list at the storage boundary

Status: Accepted
Date: 2026-10-30

## Context

Sharing offers between users (ADR-0006) meant part of each offer had to stay private: the distance to the shepherd's home, km driven, trips home, car, commute, other expenses, the rent override, the IRPF choice and the offer's free-text name describe the shepherd, not the job, and are not comparable across shepherds. Until then an offer was one flat object (`DEF_OFFER`). The project was a prototype with one user, so the saved format could change (ADR-0005).

Weighed and discarded: keeping the offer flat and splitting it by a list of private fields only in the storage adapter. It changed nothing in the model, but a field added later and missed in the list would be shared silently.

## Decision

An offer is `{ id, terms, mine }`.
- `terms`: what the employer offers, and the only part ever shared — contract, dates, duration, hours, days off, holidays, pay, extra pays, vacation, cash, totals, overnight, housing, meals given, the employer's `kmRate`, and `offerOnly`.
- `mine`: the shepherd's figures for that offer, never shared — `name`, `kmHome`, `kmWorkPerDay`, `tripsHome`, `car`, `commute`, `expenses`, `rentValue`, `irpfMode`, `irpfManual`.

Other people's offers are calculated from their `terms` with a neutral `mine` (no travel, no expenses, automatic IRPF with nothing else earned in the year). Own offers can show the same terms-only figures, so like is compared with like.

## Consequences

- What is shared is exactly `offer.terms`; privacy follows from the shape, not from a list kept by hand.
- Every reader of an offer field changes, and the saved data from before breaks without conversion; a backup is exported first.
- A new field has to be placed in `terms` or `mine` when it is added, which is the question that should be asked anyway.
- The terms-only figures leave out costs that differ between shepherds, so they are not what an offer is worth to any one shepherd.
