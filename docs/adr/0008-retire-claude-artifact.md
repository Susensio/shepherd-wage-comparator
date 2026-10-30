# ADR-0008: Retire the Claude artifact and its account sync, instead of keeping a second copy without accounts

Status: Accepted
Date: 2026-10-30

## Context

The page was published both on GitHub Pages and as a Claude artifact «Jornales de pastoreo», which was republished by hand after every visible change and saved offers to the Claude account (`storage/cloud.js`). With Supabase accounts (ADR-0006), the artifact could not run the OAuth redirect, so it would have been a second copy with a different way of saving.

Weighed and discarded: keeping the artifact with its Claude sync, and keeping it browser-only. Both kept the republishing chore and a second saving path for a copy the accounts could not reach.

## Decision

The artifact is no longer published or updated, and the Claude-account sync is removed from the code. GitHub Pages is the only place the page is published. Deleting the published artifact is left to the owner.

## Consequences

- One saving path less, and no republishing step after each change.
- Offers saved only in the Claude account have to be exported as a backup from the artifact before it goes, or they stay there.
- Nobody can use the page from inside Claude any more.
