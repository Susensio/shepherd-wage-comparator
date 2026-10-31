# ADR-0014: Read the law figures from law.js only, instead of letting each shepherd override them in Ajustes

Status: Accepted
Date: 2026-10-31

## Context

Until 31 October 2026 «Supuestos del cálculo» in Ajustes let each shepherd change the worker's and the employer's Social Security contributions, the overnight bonus, the yearly vacation days and the yearly working hours, which `DEF_CFG` took from `law.js` (the 1,826 hours were typed in `offer.js`). The owner found the settings mixing real settings with figures that should be fixed. These figures decide whether an offer is legal and what is owed; a value changed once, and saved to the account, would quietly bend every answer after it.

Weighed and discarded:
- Keeping them editable behind an «advanced» fold: hidden or not, a wrong value still bends the legality checks, and the law is the same for everyone.
- Keeping them editable for one shepherd but excluding them from shared figures: Comparar would then judge the same offer two ways.

## Decision

- The five law figures are read from `law.js` only (`LAW.ssWorkerPct`, `LAW.ssEmployerPct`, `LAW.overnightPct`, `LAW.vacationDaysPerYear`, `LAW.annualHours`), with their sources, and are explained in «Leyes». They are no longer settings.
- `ingestSaved` drops saved values under those keys from browser, backup and account data, so they neither linger nor get saved again.
- What stays in Ajustes is what differs between shepherds: «Tus datos» (rent, meals, car, other income for IRPF) and «Cómo se cuenta» (whether housing and food, and the unemployment benefit, count as money).

## Consequences

- A change in the law is made once, in `law.js`, and reaches everyone; a shepherd cannot model a different collective agreement or rate.
- Old values saved for those keys are lost on the next load; the owner's held the law's values, so no figure changed.
- The single set of contribution rates is now visible as a fixed fact: it is the temporary-contract rate, which is wrong for permanent contracts (backlog).

