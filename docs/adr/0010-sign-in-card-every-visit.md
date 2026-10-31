# ADR-0010: Keep the sign-in card coming back each visit, shrunk to a line when dismissed, with the account's status on a Cuenta tab, instead of a card dismissed for good

Status: Superseded by [ADR-0011](0011-account-button-sharing-in-comparar.md)
Date: 2026-10-31

## Context

ADR-0009 put a sign-in card at the top of Ofertas, dismissed with «Continuar sin cuenta», which was remembered in the browser; a sign-out remembered it too. On 31 October 2026 the owner found that sign-in still read as a patch on the page: once dismissed, sign-in was only in Ajustes, the first-visit welcome did not offer it, and nothing showed whether the offers were in an account. They wanted more people drawn to sign in than not: a prompt that can be dismissed but not entirely, a way to see the page is connected, the settings inside the account's tab, and a guest warned that offers are not saved in an account.

Weighed and discarded:
- Requiring an account: ADR-0006 and ADR-0009 kept the browser-only tier, and the owner still wanted a guest to be able to use the page.
- A card and a separate permanent warning shown together: two blocks saying the same thing above every tab.
- A status chip in the header: the sheep holds the top-right corner, and at 375 px the header has no room for it.

## Decision

- This narrows ADR-0009's remembered dismissal; its ways of signing in stand.
- With a project configured, the Ajustes tab is named «Cuenta»: the account section first, then «Tus datos», the assumptions and the backup.
- The tab carries a coloured dot for where the account stands: guest, connecting, a failed first upload, online, saving, offline, a failed save. The section, signed in, says the same in words.
- For a guest, the card sits under the tabs, pointing at Cuenta, on every tab but Cuenta itself. «Ahora no», or a sign-out, shrinks it to a one-line warning with «Entrar», which brings the card back. Neither is remembered: each visit starts with the card.
- After a failed first upload (ADR-0009), the same place holds a line leading to the Cuenta section.
- The first-visit welcome offers the same sign-in above the templates, with starting without an account as the alternative.
- An empty account starts like a first visit, with the templates, instead of a blank offer.
- With accounts on, the backup reminder above the offers is not shown: the card carries that warning, and an account keeps the offers.

## Consequences

- A guest sees the card on every visit and the warning line on every tab, by design.
- ADR-0009's offline-after-dismissal narrows further: Google's script loads on every guest visit, since the card or the welcome is on screen at the start of each.
- The background save reports its status, so a failure shows on the tab instead of only in the console.
- A guest who relied on the backup reminder no longer gets it above the offers; the backup is still in the Cuenta tab.

