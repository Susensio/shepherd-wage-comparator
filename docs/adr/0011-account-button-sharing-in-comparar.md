# ADR-0011: Put the account in a button on every screen with one tooltip per tab, and ask for sharing in Comparar, instead of a Cuenta tab, a card under the tabs and a switch in the account section

Status: Accepted
Date: 2026-10-31
Supersedes: [ADR-0010](0010-sign-in-card-every-visit.md)

## Context

ADR-0010, on 31 October 2026, had put the account on a «Cuenta» tab with a status dot, a sign-in card under the tabs, and a line in its place after «Ahora no». Looking at it the same day, the owner found the welcome screen off: on it the tabs were hidden, so sign-in had its own box there and moved elsewhere once a template was picked. They also disliked the line left after dismissing, wanted the prompt smaller and not tied to Google since more ways in were planned, and wanted sharing asked for where it is used instead of in the account section (ADR-0006). Mock-ups at 375 px were approved before building.

Weighed and discarded:
- Keeping the account on a tab: absent from the welcome, where the tabs are hidden.
- A status chip in the header beside the title: the sheep holds that corner.
- A sign-in card naming Google: more ways in were planned, and the card was large.
- A line left after «Ahora no»: the owner disliked a permanent row; the dot on the button already says it.
- Settings closed to guests: the figures depend on them, and taking them away pushes a guest off rather than into an account.
- Switching sharing on by itself when Comparar is opened: it shows the user's name, email and phone to others, and ADR-0006 requires the switch to say so first.
- A count of shared offers for guests: it needs a database function readable without sharing, against ADR-0006's anonymous role reading nothing.

## Decision

- A top bar on every screen, the welcome included, holds an account button: a person icon with an amber dot for a guest, the initials with a status dot when signed in, a cog «Ajustes» with no project configured.
- The button opens the account page, full screen, with «Volver» and a history entry so the phone's Back closes it. The page holds the account, then «Tus datos», the assumptions and the backup; guests keep their settings, told they are saved only in this browser.
- Tabs: Ofertas, Comparar, Leyes.
- One small tooltip per tab, hanging from the button, with «Entrar» and «Ahora no» and no sign-in method named; «Entrar» opens the page, and a sign-in started there returns to the tab. Only Ofertas (and the welcome) has one: «Guarda tus ofertas en tu cuenta. Ahora solo están en este navegador.» «Ahora no» hides it for the visit; nothing replaces it.
- Comparar has an «Otros pastores» section under the ranking instead of a tooltip. A guest sees placeholder rows with no data and «Entrar». Signed in and not sharing, it asks there, with the same disclosure as the account page's switch; accepting turns sharing on and ranks the others at once, and «Ahora no» leaves a «Compartir para comparar» button. While sharing, the others are included by default, with «Dejar de compartir» beside them.
- Kept from ADR-0009 and ADR-0010: the ways in, the upload without asking, prompts back on every visit, the save status, an empty account opening the templates, no backup reminder with accounts on.

## Consequences

- The sign-in prompt is the same on every screen, and sharing is asked for at the moment its benefit shows; the account page keeps the switch for turning it off.
- The account page is a panel swap with its own history entry, so a change to tab navigation has to keep Back and «Volver» in step.
- The disclosure text exists once in the markup and is shown in two places; Comparar adds its own lead lines above it.
- Guests see no figure of what sharing would show; a count can come later only by relaxing ADR-0006 on the anonymous role.

