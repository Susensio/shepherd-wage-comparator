# ADR-0020: Enter an offer step by step, and show it as a read-only ficha

Status: Accepted
Date: 2026-11-03

## Context

The offer form sat beside the results in the Ofertas tab, so it had to be both the place to enter an offer and the place to edit it while reading the figures. Compacting it (3 November 2026: about 3,000 → 2,100 px at 375 px) made it denser, not easier. The owner asked whether entering should be a separate phase, and approved a clickable mock-up the same day: https://claude.ai/artifact/N7vHMVyQnVBrRz76NxqzSi

Weighed and discarded:
- Keep compacting the one form: each round traded clarity for height.
- A form in a modal over the results: still one long form, now hiding what it changes.

## Decision

- A new offer is entered in a guided form, one short screen per topic in the order offers are told: template, where, when and how long, pay (amount, payslip, contract, vacation), working time and days off, housing and food, getting there. A progress bar, back, close; «Luego» skips a step; a strip at the bottom shows what is earned so far, from the model. Questions appear as earlier answers make them apply, as today.
- The offer's page becomes a read-only «ficha»: the headline and its stamp and pills, «Condiciones» as one line per step, then the analysis sections (Desglose, ¿Es legal?, negotiating, season end, the workings). Tapping a condition opens only that step, with «Guardar» and «Cancelar».
- Ofertas becomes the list of offers; Comparar and Leyes stay; Ajustes stays on the cog.
- The saved format does not change: the steps read and write the same `terms` and `mine`.

## Consequences

- The form's markup in `index.html` is replaced by step views; the conditional rules (`SHOW` in `views/form.js`), the pay answers (`pay-answers.js`) and the hints carry over.
- The browser tests that drive the form need rewriting around steps.
- More room per question: the hints shortened on 3 November can grow back where they help.

Amended by [ADR-0022](0022-earnings-without-paro-ranking-with-it.md): the ficha shows the analysis first and «Condiciones» last as one row; Duplicar, Copiar and Borrar are in a «⋯» menu.
