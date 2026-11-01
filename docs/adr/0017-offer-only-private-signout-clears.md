# ADR-0017: Keep whether an offer was worked private and clear the browser's copy on sign-out, instead of sharing the «Solo oferta» label and leaving the copy for the next account

Status: Accepted
Date: 2026-11-01

## Context

ADR-0006 shared every term of an offer with other sharers and labelled offers that were only offers «Solo oferta»; ADR-0009 uploads a browser's offers on a first sign-in. On 31 October 2026 reviews found that `offerOnly` (whether the shepherd actually worked the offer) sat in `terms`, although `AGENTS.md` keeps in `terms` only what describes the job; and that a browser signed out of one account and into another uploaded the first person's cached offers into the second account, where sharing would show them as the second person's.

Weighed and discarded:
- Keeping «Solo oferta» visible to others: it tells other shepherds which jobs a person took, which is their history, not the job's terms.
- Leaving the browser's copy after sign-out: the next account on the same browser inherits it.
- Clearing on account deletion too: the deletion text promises the browser keeps the offers, and nothing else holds them after.

## Decision

- This narrows ADR-0006 (the «Solo oferta» label) and ADR-0009 (what a sign-out leaves).
- `offerOnly` lives in `mine`. Saved data carrying it in `terms` is moved on load, account rows are rewritten on the next write, and shared rows never carry it.
- Signing out writes any pending changes to the account, then clears the browser's offers and settings and starts like a first visit, saying the offers are still in the account. Deleting the account keeps the browser's copy.

## Consequences

- Other shepherds no longer see which shared offers were only offers; the owner may still choose to share it as a label (backlog).
- After signing out the page is empty until the next sign-in.
- On a shared phone, offers kept after an account deletion would be uploaded by the next person to sign in (backlog).

