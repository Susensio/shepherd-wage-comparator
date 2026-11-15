# ADR-0034: Reclamar as a guided ladder of steps with a printable dossier and the end of the job asked, instead of a copy button for one claim text

Status: Accepted (proposed by the main agent on 14 November 2026 under the owner's mandate; accepted by the owner on 15 November 2026 when publishing it)
Date: 2026-11-14

## Context

On 14 November 2026 the owner described the page as a union assistant, a manager and a help for the shepherd across three stages of a job: negotiating an offer, recording the work, and settling the accounts at the end, and said the claim part was weak. At that moment «Reclamar» in a finished job was a heading, a copy icon for one claim text and the nearest deadline (ET art. 59.2), shown only when at least one cobro existed and something was owed; the only guidance on where to claim was one paragraph on the Leyes page. The phase of a job came from its dates alone: nothing asked how the job ended, so a dismissal, whose deadline is 20 working days (ET art. 59.3), looked like any other end. The record held days and cobros but not the employer's name, when a month was closed, any evidence, or the steps of a claim.

A design agent checked the procedures: the prior conciliation is compulsory for a wage claim (LRJS art. 63), filing it interrupts prescription and suspends caducity (art. 65.1), attendance is compulsory (art. 66); in Aragón it is filed with the Dirección General de Trabajo and held at each province's Subdirección Provincial de Trabajo; the Inspección de Trabajo's mailbox is information, not a complaint, and stops no deadline.

Weighed and discarded:
- A fourth phase «Reclamando»: a job being claimed is still a finished job; it is a sub-status of Acabada.
- «Saldar cuentas» or «Ajuste de cuentas» as the stage name: the first says the debt is paid, the second reads as revenge in Spanish; «Liquidación» is the employer's document. The stage keeps «Cuentas», and «Cuentas saldadas» names the state when nothing is owed.
- Filling or filing the official forms, or writing the demanda: legal advice the page must not pretend to give.
- Sharing the dossier through a server: no servers; the shepherd prints or shares it from the phone.

## Decision

- «Reclamar» becomes a ladder of steps, gentlest first, each with when it applies, its deadline, what to take, what the page gives, and a «Hecho» mark with a date: talk to the ganadero (a neutral summary in net, no citations); a written request to pay with a date; a union (CCOO, UGT and others, named neutrally); the compulsory conciliation (the fields of the papeleta prefilled from the record, the official procedure and office); the Inspección de Trabajo (a text of facts); the Juzgado de lo Social; FOGASA when the employer is insolvent. A dismissal comes first, in red, with a conservative 20-working-day date (weekdays only, holidays ignored, so the date shown is never later than the real one).
- The ladder shows whenever something is owed, whenever the job ended by dismissal, and when no cobro is recorded (with the prompt to record them), so a job paid nothing is not hidden.
- The ficha asks at the transitions: «¿Empezó el trabajo?» on the start date, and «¿Cómo acabó?» at the end or from «Acabó antes» in the menu (agreed end, dismissed or ended early by the ganadero, quit, sick leave or accident, extended).
- A printable «Expediente» (an HTML view with print rules, saved as PDF by the browser) gathers parties, conditions, the calendar, cobros, what corresponds and what is owed (net and gross), deadlines, what the record cannot prove, the steps done and the disclaimer.
- The record gains, in one saved-format bump (version 6): how and when the job ended, the parties (employer's name and optional tax id), when each month was closed and evidence notes with dates, and the claim steps done. All in `mine`, never shared.
- National procedural figures (ET 59.3's 20 days, LRJS 65.1's 15 days) go into `law.js` with their sources; territorial ones (mediation offices, holidays for the deadline) come from the knowledge base of ADR-0033.
- Every step says what the law says with a link and never advises beyond the amounts; the block and the dossier carry «Esto es un cálculo y una guía, no asesoramiento legal».

## Consequences

- The finished job leads somewhere: the shepherd sees the next step and its deadline, on the ficha and on the card.
- The employer's name, evidence notes and claim steps become the most sensitive data the page keeps; they stay in each shepherd's account.
- Format 6 needs a migration and raises `min_page_version`; the owner exports a backup first.
- Deadlines shown are conservative and say «como muy tarde»; until the knowledge base has holidays per municipality, the dismissal date can be earlier than the real one.
- Some legal points the design took from memory (interest for late pay, in-kind limits, FOGASA ceilings, August in dismissal deadlines, free legal aid) are left out of the texts until verified.
