# Glossary

One term on screen per concept. Use the Spanish term exactly as written here in anything the page shows; the code identifier says where the figure lives. When a new concept appears, add it here first. Interface wording (signing in, sharing, buttons) follows ADR-0012; the voice rules are in `AGENTS.md` «Language».

## Time

| Term on screen | Meaning | Code | Source | Not |
|---|---|---|---|---|
| jornada | a day worked | `r.time.daysWorked` | | día de trabajo |
| jornada normal | the hours of a normal workday: 40 h over the days worked a week, between 7.3 and 9 h | `r.extra.workday` | ET art. 34.3 | |
| jornadas de más | whole days worked beyond those due once rest days, holidays and vacation are taken | `r.extra.days`, `r.extraDays` | ET art. 37.1 | días de más, jornadas extra |
| horas extra | hours beyond the normal workday on days worked anyway | `r.extra.overtime` | ET art. 35 (horas extraordinarias) | horas de exceso |
| horas de más | all the time beyond the legal limits, in hours: the jornadas de más plus the horas extra; used only where both are added (the weekly-hours chart), always with that explanation at hand | `r.extra.hours` | | horas extra (for the total) |
| sin pagar | the part of the jornadas de más or horas extra that the pay above the minimum does not cover | `unpaidTime(r)` | | |
| libranzas | days off, not counting vacation | `terms.daysOff`, `r.time.daysOffMonth` | ET art. 37.1 (descanso semanal) | días libres (may stay as an explanation: «días libres, sin contar vacaciones») |
| descanso semanal | the legal weekly rest (day and a half) | `LAW.weeklyRest` | ET art. 37.1 | |
| vacaciones | | `terms.vacation`, `p.vacationPay` | ET art. 38 | |
| duración del contrato | | `terms.duration`, `terms.durationUnit` | | |

## Money

| Term on screen | Meaning | Code | Source | Not |
|---|---|---|---|---|
| sueldo en nómina | the pay the offer puts on the payslip, as told | `terms.payAmount`, `payType` | | salario en nómina |
| nómina bruta / nómina neta | the payslip before / after Social Security and IRPF | `r.pay.*` | | |
| en negro | money paid off the payslip | `terms.cash*`, `r.cash.*` | | en mano |
| cobras | money you receive: payslip plus en negro | Desglose «Cobras» | | te entra, entra al mes |
| ganas | what the job is worth to you: what you receive, plus housing and food when counted, minus your car and other expenses | `r.earnings.*` | | |
| salario mínimo | the minimum wage of the year | `minWageOf`, `r.min.*` | RD 126/2026 | SMI (only in legal citations) |
| plus de pernocta | the bonus for sleeping at the work site | `terms.overnight`, `LAW.overnightPct` | convenio del campo de Huesca | plus por dormir en el monte |
| pagas extra | | `terms.extraPays` | | |
| indemnización | what is owed when a temporary contract ends | `r.severance` | ET art. 49.1.c | finiquito (that is the final settlement, which includes it) |
| paro | unemployment benefit earned by contributing | `r.unemployment.*` | LGSS | prestación por desempleo (only in citations) |
| Seguridad Social | contributions, worker and employer | `ssOf(contract)`, `r.pay.rates` | Orden PJC/297/2026 | cotización (in explanations only) |
| retención de IRPF | | `r.pay.irpf`, `irpfPct` | | |
| casa y comida | housing and meals given by the employer | `terms.housing`, `terms.meal*` | | |

## Contract

| Term on screen | Meaning | Code | Not |
|---|---|---|---|
| Temporal | | `contract: 'temporary'` | eventual (except in the law's own text) |
| Fijo discontinuo | | `contract: 'seasonal'` | |
| Fijo | | `contract: 'permanent'` | indefinido |
| Sin contrato | no contract and no Social Security registration | `contract: 'none'` | en B |

The pills may add «Contrato» («Contrato temporal») where the word alone would be unclear.

## Offers and people

| Term on screen | Meaning | Code | Not |
|---|---|---|---|
| oferta | a job offer as told by the employer, with the shepherd's own figures | `{ id, terms, mine }` | trabajo, empleo |
| solo oferta | an offer received but not taken; it stays out of the year's income | `offerOnly` | |
| solo las condiciones | comparing offers on their terms alone, without the shepherd's own travel and expenses | `termsOnly` | solo las condiciones de la oferta |
| ganadero | the employer | | empresario, patrón |
| pastor, pastora | the worker; «pastores y pastoras» when addressing both | | |
| otros pastores | other users who share their offers | `state.others` | otros usuarios, los demás |
| pueblo | the village of the job, kept private | `mine.place` | localidad |
| municipio, provincia | the council and province of the job, shared | `terms.municipality`, `terms.province` | |
| ganado: ovejas, cabras, vacas | head counts per species | `terms.sheep`, `terms.goats`, `terms.cattle` | rebaño (in counts) |

## Units

| Term on screen | Code |
|---|---|
| por hora, por día trabajado, al mes, en total | `UNITS` (`units.js`) |
