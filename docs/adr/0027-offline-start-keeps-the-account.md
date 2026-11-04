# ADR-0027: A saved session whose first connection fails stays signed in and offline, and connects when it can, instead of falling back to a guest

Status: Accepted
Date: 2026-11-04

## Context

At startup a browser with a saved session connects to the account before anything else (ADR-0011, ADR-0018). Until 4 November 2026, if that first connection failed (no network in the mountains, a server error), the page showed the guest's view with «No se pudo conectar con la cuenta.»: the sign-in prompts, the tooltip, an amber guest dot, although the browser still held the user's session and the cached copy of their offers. Changes made then were recorded for the next connection only until that one attempt failed.

Weighed and discarded:
- Keeping the guest's view with the line: it tells a signed-in shepherd to sign in, and offers a second upload of offers that are already the account's.
- Showing the cached copy read-only until it connects: a shepherd out of signal for days could not note a new offer.

## Decision

The owner chose on 4 November 2026:
- When the first connection fails and localStorage holds a session naming its user (`savedUser` in `storage/account.js`), the page stays signed in as that user with the cached offers, and the account shows «offline» (`view.reconnecting` in `account-state.js`), with no failure line.
- It tries again 30 s later, and again each time, and at once when the browser says the network is back.
- What changes meanwhile keeps being recorded across the attempts (`UNSYNCED_KEY`), and is written once connected, as for any offline change.
- The profile form is hidden until the profile has been read: shown empty, saving it would blank the profile.
- Without a saved user, a failed start still ends as a guest with the line.

## Consequences

- Signing out while reconnecting fails with «No se pudo salir. Inténtalo de nuevo.»: signing out clears the browser copy, and what was not written yet would be lost.
- A first visit on a new browser with no network still cannot sign in; only a browser that was signed in before keeps working offline.
- The retry keeps running every 30 s while the tab is open and unconnected, and stops once connected.
