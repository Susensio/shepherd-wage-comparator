# ADR-0025: Enter an offer in five steps, name and «Solo oferta» first and IRPF with the pay, instead of eight steps in the order a place, a date and a payslip are told

Status: Accepted
Date: 2026-11-04

## Context

ADR-0020 split the entry into one short screen per topic: template, where, when, pay, working time, housing and food, getting there, expenses and IRPF. On 4 November 2026 the owner found fields in the wrong place (the offer's name under «¿Dónde es?», «Solo oferta» under «¿Cuándo…?»), and an audit of every field against its step found three more: the herd outside its step's title, km driven at work under «¿Cómo llegas?», and the IRPF withholding three steps after the payslip hint that shows its percentage. The step title, the Condiciones label and the fieldset label also disagreed for several steps.

Weighed with the owner:
- Fix each misplacement and add a closing step «La oferta» for name and «Solo oferta» (nine steps): the owner wanted them first and found the form too fragmented.
- Six steps (place and dates merged, car and expenses merged): the owner asked for fewer.
- Four steps (day-to-day, housing and car merged): about fourteen fields on one phone screen, and the progress strip stops saying where something is missing.

## Decision

Five steps, each about one phone screen, with one name across title, Condiciones label and fieldset:
1. Plantilla.
2. La oferta: name, «Solo oferta, no trabajada» (ticked and locked without a start date, which is now on the same screen), village, herd, start, duration, end.
3. Pago: total, payslip, IRPF withholding, contract, vacations, pagas extra. It stays alone as the heaviest step and the one most often incomplete.
4. El día a día: hours, days off, holidays, pernocta, housing, rent saved, meals.
5. Coche y gastos: trip, how often, km home, trips home, km at work, € per km, other expenses.

On the ficha, «Condiciones» opens in place as one card with its rows (one per step) divided by lines, instead of a second bordered box under its summary.

## Consequences

- Step 2 mixes the shepherd's own fields (name, «Solo oferta») with the employer's terms; the step answers "which offer is this" rather than one topic.
- The IRPF field (`mine.irpfMode`) now sits among employer terms in «Pago», next to the payslip it affects.
- `summaries()` splits the old «others» line into expenses and IRPF.
- The live step list is `STEPS` in `steps.js`; the terms are in `docs/glossary.md`.
