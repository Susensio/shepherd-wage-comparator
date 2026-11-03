# ADR-0021: Tabs at the bottom on phones; on wide screens, tabs in the top bar and Ofertas as list and ficha side by side

Status: Accepted
Date: 2026-11-03

## Context

ADR-0020 kept the tabs at the top, under the app bar, though the approved mock-up had them at the bottom. The owner preferred the bottom bar on phones, and chose a desktop layout from three drawn on 3 November 2026 (https://claude.ai/artifact/N7vHMVyQnVBrRz76NxqzSi): tabs in the top bar; a side rail of icons; or tabs in the top bar with the offers list beside the ficha.

Weighed and discarded:
- Top-bar tabs alone on wide screens: least work, but the width only adds margins and switching offers needs the list each time.
- A side rail: suits five or more sections; with three it leaves an empty strip.

## Decision

- Phones: Ofertas, Comparar and Leyes in a bar fixed at the bottom, each with an icon and its label, above the safe area; hidden while an offer is entered step by step. Ajustes and the account stay in the app bar.
- Wide screens: the tabs move into the app bar beside the name; in Ofertas the list of offers is a column on the left, with «+ Nueva oferta», and the ficha of the selected offer fills the rest.
- The app bar shows «Zurrón sindical» and its subtitle «Por un pastoreo digno» on every width.

## Consequences

- One breakpoint decides both: the bottom bar below it, top tabs and the split above it.
- On wide screens the ficha does not need its «‹ Ofertas» link, and opening an offer does not add a history entry for the list.

## Amended 3 November 2026

On phones the bar is no longer fixed to the screen: the content scrolls in its own element (`#scroller`) and the bar is placed after it, outside (`placeTabs()` in `ui/navigation.js` moves the one `.tabs` element between the app bar on wide screens and the end of the page on phones). Android Chrome's overscroll stretch then moves only the content, as the owner wanted, instead of the whole page with the bar. Accepted cost: Chrome's address bar no longer hides on scroll. Chrome's own pull-to-refresh only works on the whole page, so the page has its own (`ui/pull-refresh.js`): a pull past the top of the content, on phones, reloads. Wide screens still scroll the page.
