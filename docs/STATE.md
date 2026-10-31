# State

## Account everywhere, sharing where it is used

Decided with the owner on 31 October 2026, after mock-ups at 375 px. Narrows ADR-0010 (status on a Cuenta tab, a sign-in card under the tabs, a line after «Ahora no») and ADR-0006 (sharing switched on in the account section); record both in ADR-0011 when done.
Work stays on branch `ccr-32fbee75-oc1p8v`; `master` is not touched until the feature is complete.

### Design

- A top bar on every screen, the welcome included: the kicker on the left, the account button on the right.
  Guest: a person icon with an amber dot. Signed in: the initials (profile name, else email) in a filled circle, with a dot for the status (online, saving pulses, offline grey, failed save red). An `aria-label` says the status in words.
  Without a project configured: a cog icon, opening the same page with the settings only.
- The button opens the account page, full screen, with «← Volver» back to the tab you were on; the tabs are hidden meanwhile.
  Guest: an «Entrar» section listing the sign-in methods (Google today, more later), then «Tus datos», «Supuestos» and the backup, with «Sin cuenta, se guardan solo en este navegador». Settings stay open to guests.
  Signed in: who, the status line, sign out, the profile, sharing, then the settings and the backup, deleting the account last. No second «Cuenta» heading under the page title.
- Tabs: Ofertas · Comparar · Leyes.
- One tooltip per tab, hanging from the account button, small: a bold line, a plain line, «Entrar» and «Ahora no» on one row. «Entrar» opens the account page; no sign-in method is named in the tooltip.
  Ofertas (and the welcome): «**Guarda tus ofertas en tu cuenta.** Ahora solo están en este navegador.»
  Leyes: none. Comparar: none, the locked section below takes its place.
  «Ahora no» hides that tab's tooltip for this visit only; nothing is left in its place but the dot on the button. No line after dismissing.
- After signing in from any prompt, the page returns to the tab it came from.
- Comparar, with a project configured: an «Otros pastores» section under your ranking.
  Guest: grey placeholder rows (no figures, no request), «Compara tus ofertas con las de otros pastores.», «Entrar».
  Signed in, not sharing: the same section asks in place, with what becomes visible and to whom (the text of today's share confirmation), «Compartir y comparar» and «Ahora no». Accepting turns sharing on and includes the others in the ranking at once. «Ahora no» shrinks it to a single «Compartir para comparar» button that stays. Afterwards a hint to add a phone in the account, linking there.
  Sharing: others included by default, with a «Dejar de compartir» link; the account page keeps the switch.
- Removed: the Cuenta tab and its dot, the sign-in card under the tabs, the line after «Ahora no», the sign-in box in the welcome.
- Kept: ADR-0009's ways in (Google's button, the code by email behind `emailSignIn`), the upload without asking and the failed-upload choice (a tooltip on Ofertas leading to it), the save status, an empty account opening the templates, no backup reminder with accounts on.

### Plan

1. Top bar, account button, account page with «Volver», three tabs, the Ofertas tooltip and its per-visit dismissal, return to the tab after sign-in; remove what the design removes. Browser tests.
2. Comparar's «Otros pastores» section: placeholder for guests, sharing consent in place with «Compartir para comparar» after «Ahora no», others included by default once sharing. Browser tests.
3. ADR-0011; bring `README.md`, `AGENTS.md` and `docs/model.md` in line; check at 375 px in light and dark; then delete this section.
