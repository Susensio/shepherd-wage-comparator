# ADR-0030: Three tabs, Ofertas, Comparar and Otros pastores, with Leyes as a page behind an app-bar button, instead of Ofertas, Comparar and Leyes

Status: Accepted
Date: 2026-11-05
Supersedes in part: [ADR-0021](0021-bottom-tabs-and-desktop-split.md) (which three tabs there are) and [ADR-0013](0013-tooltip-on-three-screens.md) (that other shepherds' offers are ranked in Comparar, and the tooltip on Comparar)

## Context

On 5 November 2026 the owner decided the tab structure after five rounds of mock-ups (`docs/BACKLOG.md`, the redesign item). Comparar held two things with different audiences: the shepherd's own offers, and, below and mixed into the ranking, other shepherds' offers behind a consent, a switch and a read-only view. The laws were a tab, though they are read now and then, not worked in. The Ofertas list showed no history: the years were in Comparar, under a chart.

Weighed and discarded:
- Two tabs, «Mis ofertas» and «Otros pastores», with Leyes as an index (round 2): the owner kept Comparar.
- Keeping other shepherds in Comparar behind the include switch: it mixed own figures (with their costs) and others' (terms alone) in one list, and forced terms-only on the shepherd's own offers whenever sharing was on.
- Leyes as a fourth tab: four tabs for a section read rarely; the bottom bar has room for three labels at 375 px.
- Leyes as a page of its own, opened with a text link: a button next to Ajustes and Cuenta is where the other pages are opened from.

## Decision

- Tabs: «Ofertas» (`offers`), «Comparar» (`compare`), «Otros pastores» (`others`, a two-people icon). A stored `laws` tab opens Ofertas.
- Leyes is a page, `laws` in `PAGES` (`ui/navigation.js`, `openLawsPage`), with «Volver» and the title «Leyes y fuentes». It opens from a balance button, labelled «Leyes», left of the cog in the app bar, and from «en «Leyes»» in «¿Es legal?». Opened over a ficha, Back returns to the ficha. No tooltip on it, as before.
- Otros pastores holds what other shepherds meant in Comparar: the pitch for guests, the sharing consent and its state (`#othersBlk`), the ranking of own and others' offers together on terms alone (the unit picker, the «Ordenar» and «solo oferta» switches, «Comparar dos»; the terms-only switch shown on and locked) and the read-only view of a shared offer. They are fetched on each visit to the tab and on demand. The include switch is gone: sharing is what makes them readable, and the tab is where they are.
- The ranking is one `compareView` with a `scope` (`compare` or `others`). The tab's controls carry an `others-` prefix on their names, so their radios are not one group with Comparar's; both set the same preferences. «Comparar dos» runs in one ranking at a time (`state.pairing.scope`).
- Comparar shows only your own offers: the ranking, the head to head (its button now a primary one in a bar above the ranking, no longer a small link under the legend), the weekly-hours chart, the chart over time and «Año a año». The medals are removed (owner: lighten).
- The guest tooltip of Comparar moves to Otros pastores («Compara con otros pastores.»); Comparar has none.
- Ofertas lists by start date, latest first, under a header per year: «2026 · 3 trabajadas · 14.200 € cobrados · 180 días cotizados». The figures are computed as «Año a año» does (each contract split by days between the years, only worked offers, complete and with a duration), so they agree with that table; a year reached only by a contract from the year before has its header with no cards. Offers without a start date come first under «Por decidir». Offers of solo oferta stay muted inside their year.

## Consequences

- Browser tests that clicked the Leyes tab, counted tabs or looked for other shepherds in Comparar follow the new structure.
- Ofertas shows the years in two places for now (the headers, and Comparar's «Año a año»); the chart and the table can go once the headers are judged enough.
- The ADR-0021 bar of three tabs stays three, with different labels; the wide-screen app bar carries three tabs and three buttons.
- With no account configured, the Otros pastores tab says that the offers of other shepherds need one.
