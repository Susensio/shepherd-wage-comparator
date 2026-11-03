# ADR-0018: Clear the browser's copy when the account goes, on sign-out and on deletion, instead of keeping it

Status: Accepted
Date: 2026-11-03

## Context

Decided by the owner on 3 November 2026. ADR-0017 cleared the browser's offers on sign-out but kept them on account deletion, and a later change kept them on a sign-out during which an offer was edited (`signOut` returned `keptEdits`). On a shared phone, offers left in the browser after the account is gone would be uploaded by the next person who signs in, as theirs.

Weighed and discarded:
- Keeping the copy and warning before uploading on the next sign-in: the warning can be dismissed, and the first person's offers would still sit on the device.
- Keeping things as they were (deletion keeps the copy; a late edit keeps it): the shared-phone exposure stays.

## Decision

- This supersedes the account-deletion part of ADR-0017 and the `keptEdits` rule.
- Signing out always clears the browser's offers and settings after pending changes are written. An edit made while the sign-out request runs is lost.
- Deleting the account clears them too, and its confirmation says so and suggests downloading a copy from Ajustes first.

## Consequences

- A late edit during the sign-out request is lost (rare).
- A guest who deletes the account loses the local copy unless they exported it.
- `signOut` returns nothing; the sign-out notice «Tus ofertas siguen guardadas…» always shows.
