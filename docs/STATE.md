# State

## «Lo que te pagan»: the pay part of the offer form as four plain questions

Decided with the owner on 2 November 2026 after four mock-up rounds (https://claude.ai/artifact/MUYAADn5pFxTrLDBmXuyyN, version 4). The form changes; the model in `src/model/` does not. Work on branch `ccr-32fbee75-oc1p8v`; publish only when the owner says so.

The plan for account data at 100 users (migrations, versioned JSON, backups) was written here on 1 November and is to be built later from the owner's laptop; it is kept in git history (commit 1de5e12) and summarised in `docs/BACKLOG.md`.

### Design

One section, «Lo que te pagan», replacing «En nómina» and «En negro»; the contract moves into it from «Tiempo de trabajo». A sentence at its top tells the offer back as answered (e.g. «Te pagan 60 € al día · el salario mínimo en nómina · unos 9 € en negro · contrato temporal · vacaciones aparte.»), with figures from the model.

1. «¿Cuánto te pagan?» One amount, «al día», «al mes», or «en total» (only with a duration): everything together, what reaches the shepherd.
2. «¿Cuánto va en nómina?» «Todo», «El salario mínimo», «Una parte», «Nada, sin contrato». Only «Una parte» asks for an amount, in the same unit as 1, with «neto, lo que llega» (default) / «bruto, como en la nómina» right under it. En negro is never asked: a line shows it, worked out by the model.
3. «¿Qué contrato?» «Temporal», «Fijo discontinuo», «Fijo». Hidden with «Nada, sin contrato».
4. «¿Y las pagas extra?» «Van dentro, prorrateadas» (default) / «Dos pagas aparte». Only with «Todo» or «Una parte» and a monthly amount.
5. «¿Y las vacaciones?» «Me las pagan aparte, al acabar» / «Van dentro de lo que me pagan» / «Las libro, cobrando». The last is hidden on contracts of up to 120 days (`LAW.casualMaxDays`); RD 126/2026 art. 4: the daily minimum of those contracts excludes vacation, paid on top when not taken. Hidden with «Nada, sin contrato».

Mapping to today's `terms` (no new fields; no change to saved data):
- «Todo»: `payrollMin: false`, `payAmount` = amount, `payType: 'net'`, `payUnit` = unit, `cashMode: 'amount'`, `cashAmount: ''`.
- «El salario mínimo»: `payrollMin: true`, `cashMode: 'total'`, `totalAmount` = amount, `totalUnit` = unit.
- «Una parte»: `payrollMin: false`, `payAmount` = the part, `payType` net/gross, `payUnit` = unit, `cashMode: 'total'`, `totalAmount` = amount, `totalUnit` = unit.
- «Nada, sin contrato»: `contract: 'none'`, `cashMode: 'amount'`, `cashAmount` = amount, `cashUnit` = unit.
- Vacation: aparte → `paidAtEnd`, dentro → `included`, libro → `taken`. Extra pays: `extraPays` as today.

Existing offers are shown in the questions by reading those fields back. Shapes the questions cannot express are converted so the figures stay the same within a cent: a payslip amount plus a cash amount (`cashMode: 'amount'` with both) becomes «Una parte» with the total = net payslip + cash in a common unit, computed by the model; `payUnit: 'year'` becomes per month. The consistency spec and the sample offers' figures are the check.

### Plan

1. The section in `index.html` and its view in `src/views/form.js`; reading answers into `terms` and back in `src/events.js`; the told-back sentence and the en negro line from the model. Contract moved out of «Tiempo».
2. Conversion of existing shapes, with unit tests that each sample offer gives the same figures before and after.
3. Browser tests: each answer path, the conditional questions, the vacation option on short contracts, a saved offer of each shape loading into the right answers; `npm run check`, `npm test`; screenshots at 375 px in light and dark.
4. Records: `docs/glossary.md` for any new term, `docs/model.md` if a rule moves; delete this section.
