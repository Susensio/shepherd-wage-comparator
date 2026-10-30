# ADR-0006: Keep offers in the browser by default, with Supabase accounts and per-user sharing gated on contributing, instead of browser-only storage or anonymous pooled aggregates

Status: Accepted
Date: 2026-10-30
Supersedes: [ADR-0001](0001-static-page-no-server.md)

## Context

By 30 October 2026 offers lived in the browser, with a sync to the Claude account that only worked inside the Claude artifact (ADR-0001). The owner wanted shepherds to compare their offers with other shepherds' offers, and to be able to talk to each other about a given offer. Transparency between shepherds was the goal; the app was expected to have few users.

Weighed and discarded:
- Browser only: no comparison across users is possible.
- Anonymous pooled aggregates (an opt-in table read only through grouped views with a minimum group size): protects identities, but defeats the goal of talking to whoever shared an offer.
- A per-offer public flag: lets someone read everyone else's offers while sharing one throwaway offer, and adds a choice to every offer.
- Public reading without an account: employers and search engines read it too, and nothing is asked in return.
- Firebase (weak at aggregate queries), PocketBase or a Worker of our own (a server to run): Supabase gave Postgres, row-level security and Google OAuth with no server code, and its anon key is public by design.
- Calling the Supabase REST and auth endpoints with `fetch`: OAuth with PKCE and session refresh would be hand-written. `@supabase/supabase-js` ships a single-file UMD bundle that fits the no-build rule of ADR-0003.

## Decision

- Three tiers, each the user's choice: anonymous (browser only, no network), account (Google login first; offers and settings saved to the account), and sharing.
- Sharing is one switch per user. On, every offer of that user is shared, offer-only ones labelled «Solo oferta».
- Only a signed-in user with sharing on and at least one offer reads other people's shared offers. The `anon` role reads nothing.
- Shared offers are shown with who shared them: the OAuth name and email and profile fields such as a phone number.
- Only an offer's terms are shared (ADR-0007); the shepherd's own figures and settings stay owner-only.
- The backend is Supabase in an EU region, with `@supabase/supabase-js` vendored from its UMD bundle.
- The browser stays the default: an account is optional, and the anonymous tier never touches the network.

## Consequences

- Shepherds can compare offers and contact each other; there is a project to keep and a vendor to depend on, and the free tier pauses a project left idle.
- Security rests on the row-level security policies, since the key in the page is public. They need their own tests.
- Sharing exposes names, emails and phones to other sharers. The switch has to say exactly what becomes visible and to whom, and deleting the account has to delete everything.
- Other people's offers are read by later versions of the page, so shared rows carry a `schema_version` from the start. ADR-0005 still allows breaking the owner's own data; it no longer covers what others have shared once a second user shares.
- A second library joins lit-html in `vendor/`.
