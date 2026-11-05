# ADR-0029: Model a self-employed shepherd as a pay answer, by módulos and the RETA tramo at its minimum base, with a falso autónomo warning instead of labour-law checks

Status: Accepted
Date: 2026-11-05

## Context

On 5 November 2026 the owner asked for the option of working as autónomo: the shepherd invoices the ganadero instead of being on a payslip. It happens «a veces» in the owner's experience. The figures were researched in the BOE the same day: Orden PJC/297/2026 (RETA tables and rates, art. 18 and 37, checked against the Orden's text), LGSS art. 308.1.c (which income sets the tramo), Orden HAC/1425/2025 (módulos 2026), Ley del IVA art. 91 and RD 439/2007 art. 95.6.

Weighed and discarded:
- «Autónomo» as a fourth answer to «¿Qué contrato?»: that question only shows with a payslip, and «sin contrato» is already a pay answer; autónomo means nothing on the payslip, so it belongs with «¿Cuánto va en nómina?».
- IRPF by estimación directa with a 15 % withholding: herding someone else's livestock is in the módulos list («servicios de cría, guarda y engorde de ganado», index 0,37) and its withholding is 2 %; módulos also need no expenses from the shepherd.
- The farming special regime (SETA) and its reduced rates: it needs a holding of one's own. The tarifa plana: its 2026 amount has no legal basis found (RDL 13/2022 left it to a budget that was not passed).
- IVA at 21 % always: art. 91.Uno.2.3º gives 10 % for «cría, guarda y engorde de animales» provided to a livestock holder. Not confirmed by a ruling for a provider who is not a holder; noted in `law.js`.
- Comparing the offer with the same one as a contract: parked by the owner (backlog); entering both already compares them.
- Unknown-yet fields for the IVA: the owner chose to ask in each offer whether the amount has it inside.

## Decision

- `terms.contract = 'selfEmployed'`, set by the pay answer «Nada: se factura como autónomo»; `payAmount` per `payUnit` is what is invoiced; `terms.vatIncluded` (a checkbox) says whether it has the IVA inside. Schema version 4: every row stamped and given `vatIncluded: false`; `min_page_version` 3, since older pages do not know the contract.
- `model/self-employed.js`: invoiced (without IVA) → módulos income (× 0,37) → the tramo from that income less 7 % generic expenses, over the months registered → the quota at the tramo's minimum base × 31,50 % → IRPF on the módulos income less 5 %, added to the year as other offers' payslips leave it. `calc` treats it like «sin contrato» for the payslip (none), with no labour-law debts, savings or unpaid time, no employee's paro and no severance (its own «cese de actividad», paid within the quota, is explained, not calculated); the invoice is a part of what is earned, and the quota and IRPF are taken off in the breakdown.
- «¿Es legal?» has one warning, «Falso autónomo» (ET art. 1.1 and 8.1): the labour-law checks (minimum, rest, overtime) are not applied to an invoice. Hours and rest pills show without a verdict colour. «Para negociar», «Final de campaña» and the claim are not offered.

## Consequences

- Limits, in `docs/model.md`: no money en negro beside the invoice; other offers' IRPF does not count the autónomo's income; one activity; the quota always at the tramo's minimum base; a contract spanning two years uses one tramo.
- The 2026 figures need the yearly review like the rest of `law.js`.
- An old tab open during the release is told to reload before it writes.
