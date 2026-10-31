# ADR-0012: Give the settings their own page behind a cog in an app bar, instead of keeping them in the account page under a big header title

Status: Accepted
Date: 2026-10-31

## Context

ADR-0011, on 31 October 2026, put the account in a button on a top bar above the big header title, and the settings inside the account page. The same day the owner found the title and layout wrong with the new button (the kicker alone on the bar, the title detached below it), asked whether the settings should have their own icon, and saw the sharing block of the account page say the same thing three times. A review of the page's Spanish against the «Language» rules of `AGENTS.md` found the page talking about itself, first-person button labels and several names for one idea. Header mock-ups at 375 px were compared before deciding.

Weighed and discarded:
- A cog added to the bar of ADR-0011, the big title left below: the bar and the title stay disconnected.
- The big title with the icons beside it: the tooltip then covers the intro.
- Settings left in the account page: they are not about the account, a guest reaches them through a sign-in page, and a cog is where people look for them.

## Decision

- This narrows ADR-0011: the account button, the tooltips and «Otros pastores» in Comparar stand.
- An app bar on every screen holds the sheep as the logo, «Comparador de jornales» with «Para pastores y pastoras», a cog and the account button. The big header title goes; the intro stays below.
- The cog opens «Ajustes» («Tus datos», «Supuestos», «Copia de seguridad»), a page like the account page, with «Volver» and its own history entry, saying whether the settings are kept in the account or only in this browser. Without a project only the cog shows.
- The account page holds only the account; sharing is said once there, under «Otros pastores».
- One word per idea in the page's Spanish: «Entrar» and «Salir»; «compartir tus ofertas» and «dejar de compartir»; «otros pastores»; «se ven»; «Reintentar» on buttons and «Inténtalo de nuevo» in messages; buttons in the infinitive, never in the first person; the page never talks about itself; no sign-in method named outside its own button.

## Consequences

- Two pages share one mechanism (open, «Volver», Back, scroll restore); a third would reuse it.
- The page's `h1` is now the small bar title, so the welcome's «¿Cuánto te pagan de verdad?» carries the visual weight on a first visit.
- The terminology lives only in this record and in the strings; new text has to be checked against it by hand.

