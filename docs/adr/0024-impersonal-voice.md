# ADR-0024: Speak impersonally in questions, answers and labels, rewritten for the best plain style rather than translated from «tú», and keep «tú» only for instructions to the reader

Status: Accepted
Date: 2026-11-04

## Context

Until 4 November 2026 the page addressed the shepherd as «tú» everywhere («¿Cuánto te pagan?», «¿Duermes en el monte?», «Ganas»), with a few answer labels in first person («Me las pagan aparte», «Con mi coche») against the rule in `AGENTS.md`. The owner had already found «Lo que te pagan» too colloquial (backlog, 2 November 2026). Other shepherds' shared offers were already worded impersonally, through `say(you, they)` in `voice.js` and `third` flags at about 70 call sites.

An audit of the entry form on 4 November 2026 raised the voice again. An inventory counted about 280 lines of user-facing text in some 25 files and about 80 test lines that would change. Three options were weighed with the owner:
- Keep «tú» and only fix the first-person answers: least work, leaves the colloquial tone.
- Everything impersonal: instructions to the reader become stiff infinitives or «se» sentences («Tocar una oferta para verla», «Apuntar las ofertas… y ver cuánto se gana»), and «se» was reserved in `AGENTS.md` for what the page itself does.
- Impersonal for questions, answers and labels, «tú» for instructions only.

## Decision

The third option. Questions, answers, labels, headings, figures and explanations are impersonal; instructions addressed to the reader («Toca una oferta», «Recarga la página», the intro's invitation) keep «tú» in the imperative. First person goes everywhere.

The owner added: impersonal is a style, not a translation. Where a mechanical «se» reads worse, the text is rewritten in the plainest form that says the same: a noun instead of a verb for labels («Pago», «Ganado», «Cobrado», «Coche propio»), an explicit subject where one exists («¿Pone casa el ganadero?», «Lo que debe el ganadero»), the domain term where there is one («¿Hay pernocta en el monte?»). The wording is proposed as a full table and approved by the owner before it is applied.

## Consequences

- Own and shared offers read the same, so the `you` branch of `say` and most `third` flags can go; the shared-offer test that no text says «tú» becomes a test that no question, answer or label does.
- New glossary terms replace second-person ones («te pagan», «ganas», «cobras»), and the glossary is updated before the text.
- Two voices remain on the page, split by what a sentence does (asks or labels versus tells the reader to act); each new string has to be placed on one side.
- The live rule is the Language section of `AGENTS.md`.
