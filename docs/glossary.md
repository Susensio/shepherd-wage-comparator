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
| vacaciones aparte, al acabar | worked and paid on top at the end | `vacation: 'paidAtEnd'` | | pagadas aparte |
| vacaciones dentro | worked, and already inside the pay | `vacation: 'included'` | | incluidas |
| vacaciones libradas | days off, paid | `vacation: 'taken'` | | disfrutadas |
| duración del contrato | | `terms.duration`, `terms.durationUnit` | | |

## Money

| Term on screen | Meaning | Code | Source | Not |
|---|---|---|---|---|
| sueldo en nómina | the pay the offer puts on the payslip, as told | `terms.payAmount`, `payType` | | salario en nómina |
| nómina bruta / nómina neta | the payslip before / after Social Security and IRPF | `r.pay.*` | | |
| en negro | money paid off the payslip | `terms.cash*`, `r.cash.*` | | en mano |
| cobrado | money received: payslip plus en negro. A noun in rows and ledgers («Cobrado»), «se cobra» in a sentence | Desglose «Cobrado» (`r.earnings.received`) | | cobras, te entra, entra al mes |
| se gana / total | what the job is worth to the shepherd: what is received, plus housing and food when counted, minus the car and other expenses. «Se gana» in the headline, the tags, the share card and sentences; «Total» in rows and ledgers (owner, 4 November 2026: «Ganado» read as livestock) | `r.earnings.*` | | ganas, ganado, beneficio |
| salario mínimo | the minimum wage of the year | `minWageOf`, `r.min.*` | RD 126/2026 | SMI (only in legal citations) |
| plus de pernocta | the bonus for sleeping at the work site | `terms.overnight`, `LAW.overnightPct` | convenio del campo de Huesca | plus por dormir en el monte |
| pagas extra | | `terms.extraPays` | | |
| indemnización | what is owed when a temporary contract ends | `r.severance` | ET art. 49.1.c | finiquito (that is the final settlement, which includes it) |
| paro | unemployment benefit earned by contributing. Not part of «se gana»: said under the headline («Y genera N días de paro: unos X €, que se cobran más adelante»), beside the money in Comparar («+ 428 € de paro», «sin paro») and, for money en negro, in the lever «En negro» of «Para negociar» | `r.unemployment.*` | LGSS | prestación por desempleo (only in citations) |
| autónomo | a shepherd who invoices the ganadero instead of being on a payslip: the answer «Nada: se factura como autónomo» to «¿Cuánto va en nómina?», the stamp and pill «Autónomo» (ADR-0029) | `terms.contract: 'selfEmployed'`, `r.selfEmployed` | LGSS art. 305 | por cuenta propia (only in citations), freelance |
| factura | what the ganadero pays an autónomo, without IVA: the breakdown's row «Factura» | `r.selfEmployed.invoiced` | | |
| cuota de autónomos | the self-employed Social Security contribution, by tramo of income | `r.selfEmployed.quota` | Orden PJC/297/2026 art. 18 | RETA (only in citations), cuota del RETA |
| falso autónomo | work invoiced as self-employed that the law treats as employment (another's livestock, pasture and orders): the warning in «¿Es legal?» | `rightsOf` (`contract`, warn) | ET art. 1.1 and 8.1 | |
| IVA | the value-added tax on the invoice; taken off only when the agreed amount has it inside («La cantidad lleva el IVA dentro») | `terms.vatIncluded`, `LAW.selfEmployed.vatPct` | Ley del IVA art. 91 | |
| Seguridad Social | contributions, worker and employer | `ssOf(contract)`, `r.pay.rates` | Orden PJC/297/2026 | cotización (in explanations only) |
| retención de IRPF | | `r.pay.irpf`, `irpfPct` | | |
| lo que se paga / Pago | everything the offer pays together, payslip and en negro: the first answer of the step «Pago», what reaches the shepherd. «Pago» is the step and the label; «lo que se paga» in a sentence | `terms.payAmount`, `totalAmount` or `cashAmount`, by the answer (`pay-answers.js`) | | te pagan, lo que te pagan, cobras (that is the Desglose figure) |
| lo que debe el ganadero | what the employer owes when the pay falls short of the minimum: «Lo que debe el ganadero» as a row, «Debe el ganadero X» in a sentence | `r.debt.*` | | te deben, se le deben |
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
| ficha | the read-only page of one offer: «Condiciones» first, then its result with the paro line and the «Análisis» | `views/ficha.js` | página de la oferta, resumen |
| Condiciones | the ficha's first block, one row with a one-line summary that opens one row per step: La oferta, Pago, El día a día, Coche y gastos; tapping one opens only that step | `CONDITION_STEPS` (`steps.js`) | datos de la oferta |
| Análisis | the ficha's sections under the headline: Desglose, ¿Es legal?, Para negociar, Final de campaña, and the small link «Cómo se calcula» (the workings) | `resultParts().analysis` | |
| paso | one screen of the guided entry («Paso 2 de 5»): Plantilla, La oferta, Pago, El día a día, Coche y gastos. The title, the row in Condiciones and the fieldset share one name; a step opened from the ficha says «Cambiar» and ends with «Guardar» or «Cancelar» | `STEPS` (`steps.js`), `ui/entry.js` | pantalla, sección |
| plantilla | a starting point picked in the first step of the entry; it fills the contract, the housing and the trips, not the figures | `TEMPLATES` (`offer.js`) | modelo |
| solo oferta | an offer received but not taken; it stays out of the year's income. An offer without a start date always counts as one (the box is ticked and locked until a date is set); shared (ADR-0028) | `terms.offerOnly` | |
| sin desplazamientos ni gastos propios | comparing offers on their terms alone, without the shepherd's own travel and expenses: the Comparar switch | `termsOnly` | solo las condiciones (reads as the ficha's «Condiciones») |
| «⋯» (Más acciones) | the menu of an offer, on the ficha and on each card: Duplicar, Copiar ficha, Copiar reclamación, Borrar | `ui/offer-menu.js` | menú, opciones |
| con el paro / sin el paro | how Comparar ranks: «Ordenar: Con el paro · Sin el paro», with or without the paro each offer generates (ADR-0022) | `moneyOnly` | solo lo que se gana |
| ganadero | the employer | | empresario, patrón |
| pastor, pastora | the worker; «pastores y pastoras» when addressing both | | |
| otros pastores | other users who share their offers; also the name of the third tab, where they are ranked with your own offers (ADR-0030) | `state.others`, `data-tab=others` | otros usuarios, los demás |
| Por decidir | the header over the offers without a start date or starting after today, first in Ofertas (ADR-0030) | `UNDECIDED` (`views/offers-list.js`) | sin fecha, pendientes |
| Leyes y fuentes | the page of the laws and their sources, opened from the balance button of the app bar, as Ajustes and Cuenta (ADR-0030) | `data-panel=laws`, `openLawsPage` | pestaña de Leyes |
| pueblo | the village of the job, shared (ADR-0028) | `terms.place` | localidad |
| municipio, provincia | the council and province of the job, shared | `terms.municipality`, `terms.province` | |
| coche propio | the shepherd drives their own car to the job: «Coche propio», «Sin coche propio» | `mine.car = 'own'` / `'noCar'` | tu coche, con mi coche |
| Datos comunes | the figures shared by every offer, set in Ajustes (rent, meal prices, fuel, other income) | `cfg` | Tus datos |
| rebaño: ovejas, cabras, vacas | the herd, as head counts per species | `terms.sheep`, `terms.goats`, `terms.cattle` | ganado |
| registro | what happened in a job: the days of each month and the cobros, kept in `mine.record`, never shared (ADR-0032) | `mine.record`, `OfferRecord` (`model/settle.js`) | | diario, historial |
| mes cerrado | a month whose days the shepherd froze as they were; the offer no longer changes it. Any other month is «según la oferta», an estimate | `record.months[key].closed`, `row.closed`, `row.estimate` | | mes pasado, mes confirmado |
| cobro | a payment received: date, amount and how (nómina, en mano, transferencia) | `record.payments`, `Payment` (`model/settle.js`) | | pago (a payment the employer makes is a «pago» in the pay answers) |
| fase | where a job is in time, from its dates: por decidir, en curso, terminada; «solo oferta» is never worked | `phaseOf` (`model/phase.js`) | | estado, modo |

## Units

| Term on screen | Code |
|---|---|
| por hora, por día trabajado, al mes, en total | `UNITS` (`units.js`) |
| palanca (Para negociar) | one thing the ganadero saves at the shepherd's expense, as a row: what the ganadero saves, what it means for the shepherd, and a copy icon for a neutral text to send | `leversOf` (`text.js`) | | exigencia, reclamación (a claim is something else) |
