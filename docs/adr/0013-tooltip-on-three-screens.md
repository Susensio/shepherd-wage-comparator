# ADR-0013: Show the sign-in tooltip on Ofertas, Comparar and Ajustes, dismissed for all of them at once, instead of on Ofertas alone

Status: Accepted
Date: 2026-10-31

## Context

ADR-0011 gave the sign-in tooltip to Ofertas alone, with «Otros pastores» as Comparar's pitch, and let «Ahora no» hide it per tab; ADR-0012 then moved the settings to a page of their own. On 31 October 2026, after publishing, the owner found that a guest saw the tooltip only on Ofertas and asked for it on Comparar and Ajustes too, until dismissed once for all of them.

Weighed and discarded:
- Leaving Comparar to its «Otros pastores» section: it sits below the ranking, so a guest who does not scroll never meets it.
- A dismissal per screen, as before: three «Ahora no» to silence one prompt.

## Decision

- This narrows ADR-0011 on where the tooltip shows and how it goes.
- A guest gets the tooltip on Ofertas (and the welcome), Comparar and Ajustes, each with its own message: on Comparar the benefit of comparing with other shepherds, on Ajustes keeping the settings on any device (the page already says they are only in this browser). Not on Leyes, not on the account page.
- One «Ahora no», or a sign-out, hides it everywhere for the visit; it comes back on the next.
- Signing in from the tooltip on Ajustes returns to Ajustes.

## Consequences

- Comparar shows the tooltip and, below the ranking, «Otros pastores» with its own «Entrar»: two prompts on one screen for a guest who has not dismissed the tooltip.
- A new screen gets a tooltip by adding a message to `GUEST_TIPS`.

