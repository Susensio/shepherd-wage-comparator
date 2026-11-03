# ADR-0022: «Ganas» is money only; the paro is shown beside it and joins it only to rank offers

Status: Accepted
Date: 2026-11-03

## Context

«Ganas» added the unemployment benefit an offer generates (`earnings.parts.unemployment`, on by default with the «Contar el paro que generas» setting), spread over the contract's months. The owner found it made the headline grow too much to be realistic (Puerto A: 2.739 €/mes, of which 428 € paro). Removing it would rank money paid en negro as well as declared pay, so the employer who pays en negro would come out best. Weighed on 3 November 2026 with mock-ups (https://claude.ai/artifact/N7vHMVyQnVBrRz76NxqzSi, rows «Desglose», «Ficha y Comparar», «El negro…», «Lo que ganas y el paro que genera»):

- Subtracting from money en negro the paro it does not generate: law-based, but zero when the declared pay already reaches the benefit's maximum (Puerto A), so en negro would cost nothing there.
- Subtracting what the employer saves by paying en negro, or adding the contributions paid («cotiza»): never zero, but contributions read as money taken away and are abstract to a shepherd.
- A setting to add, subtract or ignore the paro: every figure and the ranking would depend on a switch most people never open.
- Two headline figures: they compete, and the ranking needs one order.

## Decision

- «Ganas» (headline, Desglose, every unit) is money that reaches you, plus housing and food when counted, minus your expenses. The paro is not part of it. The «Contar el paro que generas» setting goes; a saved value is ignored.
- Under the headline, its own line: «Y genera N días de paro: unos X €, que se cobran más adelante» (or why it generates none).
- Comparar ranks by «Ganas» plus the paro, in the chosen unit, and shows both in each row («2.311 € · + 428 € de paro»; «sin paro» when there is none), with a line saying how it is ordered. A chip «Solo lo que ganas» ranks by money alone. The sum itself is never shown.
- «Sin cotizar», in Análisis, says in words what money en negro does not give: no contributions for the pension or sick leave, and the paro it does not generate, in euros where the law gives a figure (below the benefit's maximum).
- The ficha (layout A of the mock-ups): a «⋯» menu beside the name with Duplicar, Copiar ficha, Copiar reclamación and Borrar; the analysis right after the headline; «Condiciones» last, as one row with a one-line summary that opens the rows. Each card in the offers list has the same «⋯» menu; on wide screens, right-click opens it too.

## Consequences

- Every «Ganas» figure drops by the paro; Comparar's order changes little, since it still counts it. Offers without a contract, which generate no paro, rank lower than by money alone, but a short, well-paid one can still rank high: the order shows it, it is not forced.
- `earnings.total` and its parts no longer hold the paro; `r.unemployment` keeps it for the line, the ranking and «Cara a cara».
- Supersedes the paro part of the Desglose and the setting; ADR-0014's list of settings loses one.
