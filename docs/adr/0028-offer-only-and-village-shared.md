# ADR-0028: Share whether an offer was worked and its village, as terms in schema version 3, instead of keeping both in the shepherd's own figures

Status: Accepted
Date: 2026-11-04
Supersedes: the first half of [ADR-0017](0017-offer-only-private-signout-clears.md) (the sign-out half stands); the private village of [ADR-0015](0015-village-search-preloaded.md)

## Context

ADR-0017 moved `offerOnly` (an offer received but never worked) from `terms` to `mine`, so other shepherds could not tell which jobs a person took. ADR-0015 kept the village (`place`) in `mine` for the same reason, sharing only municipality and province. On 1 November 2026 the owner decided that whether an offer was worked is a fact about the offer: offers that were worked show what was actually paid, which aggregates of other shepherds' offers need. On 4 November 2026 the owner decided the village is shared too: more precise for other shepherds than the municipality.

Weighed and discarded:
- Keeping both private: aggregates could not tell paid offers from mere offers, and «where» stays as coarse as a municipality.
- Sharing `offerOnly` but not the village, or the reverse: the two moves need the same migration, upgrader and version, so they go together.
- Moving them without a version (as ADR-0017 did): pages of both kinds would write both shapes for days, and rows could not tell which they hold.

## Decision

- `offerOnly` and `place` are in `DEF_TERMS`, shared with the rest of the terms (ADR-0006).
- Schema version 3. Migration `20261104120000_offer_only_and_village_in_terms.sql` rewrites every account row: both keys into `offers.terms` (from `offer_mine.mine`, which wins over a stale `terms.offerOnly`; else `false` and `''`), removed from `mine`, `schema_version = 3`, and `app_meta.min_page_version = 2`, so pages of version 1 stop writing. `upgrade[2]` in `schema.js` does the same for browser copies and backups.
- Comparar tags other shepherds' offers that were only offers, as it tags one's own («solo oferta», muted, dashed edge), and «Incluir las que no se trabajaron» hides them with one's own. The shared view's «Dónde» names the village. The sharing consent says the village and whether the offers were worked are seen.

## Consequences

- With the sharer's name, others can tell which offers a person took, and the village can point to the farm. Accepted by the owner.
- Aggregates can count worked offers by default: a worked offer is one with a start date and not marked «solo oferta» (`workedOffers`).
- An old tab open during the release is told to reload before it writes again.
