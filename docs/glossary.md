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
| libranzas | days off, not counting the weekly rest owed: a libranza and a vacation day are the same mark, «libre», on the calendar (the vacation owed comes from the offer's terms, not from day marks) | `terms.daysOff`, `r.time.daysOffMonth`, day kind `off` | ET art. 37.1 (descanso semanal) | días libres (may stay as an explanation: «días libres, sin contar vacaciones») |
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
| en negro | money paid off the payslip. On the screens of what happened it is a line of the ledgers, «En negro»: the cash agreed (net, as handed), inside «Corresponde»; «De lo cobrado, en mano» is what arrived in hand | `terms.cash*`, `r.cash.*`, `row.agreedCash` | | en mano (except as the label of how a cobro was paid) |
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
| cobro | a payment received: date, amount and how (Nómina, En mano) | `record.payments`, `Payment` (`model/settle.js`) | | pago (a payment the employer makes is a «pago» in the pay answers) |
| fase | where a job is in time, from its dates, shown as a pill: «Por decidir», «En curso», «Acabada»; «solo oferta» has none, it is never worked. An offer with no end date stays «En curso»; a job worked past the offer's end stays «En curso» until its last day worked: the end that counts is the later of the offer's and the last day marked as worked | `phaseOf` (`model/phase.js`), `PHASE_TEXT` (`text.js`) | | estado, modo, terminada |
| Corresponde | what the job is worth to the shepherd by the days really worked, in NET (the total of the job, never month by month in a payment sense): with a net total agreed (`cashMode: 'total'`, «total pactado») it is that total scaled by the days worked, with no simulated withholding; otherwise the payroll gross × `r.netFactor` plus the cash agreed as handed. «Corresponde» in the ledgers and tiles, «lo que corresponde» in a sentence. Gross only in the claim text, where it is what is claimed | `standingOf().corresponde`, `row.due` | | devengado (jargon), ganado (that is «se gana», and livestock), generado, cobrable, bruto (on these screens) |
| Hasta hoy | the block of a job En curso: the tiles Corresponde, Cobrado and Falta, in net, for the months that have ended and the current one so far; the vacation goes apart, payable at the end. «Cantidades netas: lo que llega, sin retenciones» | `views/record.js` | | |
| Cuentas | the small title of the mode of a job Acabada, which puts the result first and the chores last: the yellow block «Debe el ganadero» with the tiles Corresponde, Cobrado and Falta; «Balance del trabajo»; «¿Se cumplió la ley?»; «Reclamar» when Falta is above 0; the fold «Registro del trabajo»; and the closed fold «Oferta original» | `views/record.js` | | liquidación, Regularizar |
| Falta | what is still to be paid: Corresponde − Cobrado, in net, never below 0: the same word and meaning in Registro and Cuentas. «Debe el ganadero» is the headline of the same figure once the job is over. When more was cobrado than corresponds there is no «de más» and no debt: «Falta 0 €» and a neutral line that real payslips differ from the simulated ones | `standingOf().falta` | | pendiente, deuda, cobrado de más, pagado de más |
| Cobros | the block that totals what was received (net, as it arrived) as a free list, never tied to a month: every cobro listed, each with «Quitar» (two taps), month headers only when they span several months, and «+ Apuntar cobro»; the sheet is «Cobro»: Cantidad, Fecha, Forma de pago (Nómina or En mano), Nota. Cobrado is shown as a total, «de ello, en mano X €» small. «Nómina» is paid by bank transfer and declared; «En mano» is en negro. «En mano» is allowed as the label of the way; «en negro» stays the term for undeclared pay everywhere else. When En mano shows nothing cobrado but cash was agreed: «Sin cobros en mano apuntados», a prompt, not an accusation | `record.payments`, `via: 'payroll' \| 'cash'` | | pago, transferencia |
| Cerrar mes / Reabrir | the buttons that freeze a month's days as they are shown («Cerrar junio») or let them change again (it asks to confirm). Months exist only for days: Corresponde depends on the days really worked. In a closed month, days libre before the first day worked of the job's first month, or after the last day worked of its last month, lie outside the job: a monthly or total wage is prorated by the days inside (1/30 a day), a wage per day does not change; the calendar cannot tell «libre because the contract ended» from «libre as the last rest». A month is closed only after it has ended and from its calendar or from «Revisar los meses», never in bulk | `closeMonth`, `reopenMonth` (`model/record.js`) | | confirmar mes |
| según la oferta | the state of a month not closed: its days follow the offer and its figures are an estimate. The months strip says «cerrado», «por cerrar» (ended, not closed), «en curso» or «por venir» | `row.estimate` | | previsto |
| Revisar los meses | the one action of the yellow block while months are not closed: the flow that goes month by month through them, with its calendar, «Cerrar <mes>» or «Saltar», «Agosto, 1 de 3», and a history entry so Back leaves it for the ficha. The figure is not firm until every month is closed | `ui/record.js`, `openReview` (`ui/navigation.js`) | | Revisar los meses, Registrar lo que falta |
| plazo para reclamar | the year after a pay was due in which it can be claimed (ET art. 59.2). The main view says one line, «Plazo más cercano: lo de <mes>, hasta el <fecha> · quedan N días»; the deadline of each month is in the closed fold «Plazos por mes». The payments are assigned oldest first only to date the claim | `row.deadline`, `LAW.claimYears` | ET art. 59.2 | caducidad, prescripción |
| Análisis de la oferta | the closed fold that keeps what was worked out before the job (Desglose, ¿Es legal?, Para negociar, Final de campaña, Cómo se calcula) under the record of a job En curso. A job Acabada has «Oferta original» in its place | `data-fold=analysis` | | |
| jornada, libre, baja | what a calendar day is: a day worked, a day off (libranza or vacation), a day sick (kept in the record, no control for it yet) | day kinds `work`, `off`, `sick` | | |
| Trabajo real | the period the work really had, which follows the calendar and not the offer's dates: from the first day worked to the last. The line «Trabajo real: del <fecha> al <fecha> (oferta: <fecha>)» appears near «Condiciones» only where it differs from the offer's. Derived from the days marked, with nothing to edit | `settle().job` (`model/settle.js`) | | fechas reales, prórroga |
| Añadir mes | the quiet button «+ Añadir <mes>» after the last month of the job, that opens the next month's calendar with every day libre. If nothing is marked in it, it is not part of the job; one day marked worked extends the job to that day, and the months between are included. A month after the offer's end enters only that way | `addMonth` (`ui/record.js`) | | prorrogar, ampliar |
| Registro (mode) | the mode of a job En curso: the months strip, «Hasta hoy», the current month's calendar «Días» and «Cobros». The data behind it is «registro» above | `views/record.js` | | |
| ¿Se cumplió la ley? | the block of Cuentas that judges facts only, from the record: weekly rest and days worked above those due use closed months only (periods wholly inside closed months) and say «sobre N de M meses cerrados»; with no month closed it is one line, «Cierra los meses para comprobarlo». The plus de pernocta and the minimum on payroll are judged only when every month is closed and a payroll cobro exists, else «Se comprobará al cerrar todos los meses». The minimum compares the payroll received in net with the net equivalent of the minimum, failing only beyond a margin for withholding differences. What cannot be checked (festivos, the minimum against the real payslip) is one line | `lawFromRecord` (`model/compliance.js`) | | ¿Es legal? (that is the offer's, before the job) |
| Detalle de lo que corresponde | the closed fold inside «Balance del trabajo» that splits Corresponde into Salario, Plus de pernocta, Vacaciones and En negro (the cash agreed, as handed): the lines add up to Corresponde | `standingOf().lines` | | Por conceptos |
| Balance del trabajo | the balance of a job Acabada, its own visible block: what it came to (Corresponde, firm only with every month closed, else «estimado»), Cobrado split into nómina and en mano, the days worked (real in closed months, «según la oferta» in the rest) and the days contributed and the paro generated (always «según la oferta»: the real payslip is not recorded). It comes from «Final de campaña» without its payslip simulator | `balanceOf` (`model/accounts.js`) | | Final de campaña (that is the offer's) |
| Registro del trabajo | the one section of Cuentas that holds the chores: the months (state; a tap opens the month's calendar; «+ Añadir <mes>») and «Cobros». It is open only while something remains to record (a month not closed, or no cobro) and closed otherwise | `data-autofold=registro` | | Registrar lo que falta |
| Oferta original | the closed fold at the end of Cuentas with the original analysis, for comparing promise and reality: Desglose, ¿Es legal?, Final de campaña with its payslip simulator, Cómo se calcula. «Para negociar» is not in it. It is a reference, not part of the result | `data-fold=reference` | | Análisis de la oferta (that is under the record of a job En curso) |

## Units

| Term on screen | Code |
|---|---|
| por hora, por día trabajado, al mes, en total | `UNITS` (`units.js`) |
| palanca (Para negociar) | one thing the ganadero saves at the shepherd's expense, as a row: what the ganadero saves, what it means for the shepherd, and a copy icon for a neutral text to send | `leversOf` (`text.js`) | | exigencia, reclamación (a claim is something else) |
