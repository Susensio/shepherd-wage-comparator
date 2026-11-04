# Wording table: impersonal voice (ADR-0024) and five steps

Draft for the owner's approval, 4 November 2026. Lines not listed stay as they are.
Kept in «tú» as instructions: Apunta, mira, Compara, Marca, Toca, Entra, Guarda, Elige, Recarga la página, Pon 0, Márcalo, Inténtalo, Añade, Descarga, cópiala.

## Owner's decisions, 4 November 2026 (these override the tables below)

1. La oferta. 2. Pago. 3. Ganado / Cobrado. 4. «Incluidas en el pago». 5. «a costa del pastor». 6. Sheep-click quips unchanged («Contigo hasta la majada», «Mi pastor no se regala»). 7. «¿Hay pernocta en el monte?». 8. «se tiene derecho a librarlas» (the draft's wording). 9. Intro keeps both voices. 10. Template stories rewritten as notes, e.g. «Borda en el monte; bajadas en las libranzas».
Everything else in the tables is approved as written.

## To decide first (least sure)

| # | Choice | Proposed | Alternative |
|---|---|---|---|
| 1 | Step 2 name | La oferta | Dónde y cuándo |
| 2 | Step 3 title | Pago | ¿Cuánto se paga? |
| 3 | Table rows | Ganado / Cobrado | Se gana / Se cobra |
| 4 | Vacations-included answer | Van dentro del pago | Incluidas en el pago |
| 5 | «a tu costa» | a costa del pastor | — |
| 6 | Sheep-click quips | Hasta la majada, con todo / El pastor no se regala | keep «Contigo…» / «Mi pastor…» as jokes |
| 7 | Sleeping out | ¿Hay pernocta en el monte? | ¿Se duerme en el monte? |
| 8 | rights.js:125 | se tiene derecho a librarlas | hay derecho a librarlas |
| 9 | Intro mixes voices | «Apunta… tal como las proponen y mira cuánto se gana…» | — |
| 10 | Template stories | «Se duerme en la borda; se baja cuando se libra.» | «Borda en el monte; bajadas en las libranzas.» |

## Entry steps

| Where | Now | Proposed |
|---|---|---|
| steps.js | ¿Cuánto te pagan? | Pago (step 3) |
| steps.js | Jornada y libranzas + Casa y comida | El día a día (step 4) |
| steps.js | ¿Cómo llegas? + Tus gastos y el IRPF | Coche y gastos (step 5); IRPF moves to Pago |
| steps.js | Dónde / Cuándo | La oferta (step 2) |
| index.html:353 | no lo sé | No se sabe |
| index.html:365 | Si pones la fecha, la duración se ajusta. | Si se pone la fecha, la duración se ajusta. |
| index.html:377 | aria Lo que te pagan | Pago |
| index.html:380 | Todo junto, lo que te llega | Total que llega |
| index.html:410 | hasta que cambies una respuesta | hasta que se cambie una respuesta |
| index.html:423 | Van dentro de lo que me pagan | Van dentro del pago |
| index.html:424 | Me las pagan aparte, al acabar | Se pagan aparte, al acabar |
| index.html:425 | Las libro, cobrando | Se libran, cobrando |
| index.html:449 | ¿Cuántos días libras? | ¿Cuántas libranzas? |
| index.html:461 | ¿Libras también los festivos? | ¿Se libran también los festivos? |
| index.html | ¿Duermes en el monte? | ¿Hay pernocta en el monte? |
| index.html | ¿Te ponen casa? | ¿Pone casa el ganadero? |
| index.html:489 | Lo que te ahorras de alquiler (€/mes) | Alquiler que se ahorra (€/mes) |
| index.html:491 | ¿Qué comidas te dan? | ¿Qué comidas se dan? |
| index.html:508 | Con mi coche | Coche propio |
| index.html:509 | …lo que te paguen por ellos | …lo que se pague por ellos |
| index.html:515 | ¿Cómo llegas al trabajo? | ¿Cómo se llega al trabajo? |
| index.html:521 | Km con tu coche al día | Km con coche propio al día |
| index.html:523 | Te pagan por km (€) | Pago por km (€) |
| index.html:529 | Otros gastos que pones tú (€/mes) | Otros gastos propios (€/mes) |
| index.html:298 | ¿Cuánto te pagan de verdad? | ¿Cuánto se paga de verdad? |
| index.html:299 | …tal como te las proponen… cuánto ganas… | …tal como las proponen… cuánto se gana… |
| index.html:301 | …mira cuál te deja más. | …mira cuál deja más. |
| index.html:302 | …cuánto te deben si no. | …cuánto debe el ganadero si no. |
| index.html:305 | Nadie más ve tus ofertas, salvo que las compartas. | Nadie más ve las ofertas, salvo que se compartan. |
| index.html:306 | Tus ofertas siguen guardadas en tu cuenta. | Las ofertas siguen guardadas en la cuenta. |
| index.html:308 | …las cifras (horas, sueldo…) las pones tú. | …se escriben a mano. |
| offers-list.js:44 | Todo lo pones tú. | Todo se pone a mano. |
| form.js:43 | marca «no lo sé» | marca «No se sabe» |
| form.js:44-47 | cuánto ganas / lo que te pagan / si te pagan las vacaciones | cuánto se gana / el pago / si se pagan las vacaciones |
| form.js:139 | Te pagan <b>…</b> | Pago <b>…</b> |
| form.js:162 | …supera lo que te pagan… | …supera el pago… |
| form.js:207 | En la renta te devolverían unos X | En la renta se devolverían unos X |
| form.js:231 | …con tu coche… «Tus datos» | …en coche propio… «Datos comunes» |
| form.js:268 | Te ahorras X por día trabajado | Se ahorra X por día trabajado |
| form.js:272 | Pon 0 si sigues pagando tu casa. | Pon 0 si sigues pagando la casa. |

## Ficha and result

| Where | Now | Proposed |
|---|---|---|
| result.js:229-230 | ¿Cuánto ganas? / Ganas | ¿Cuánto se gana? / Se gana |
| result.js:187-200 | Desglose: cobras · Cobras · Ganas | Desglose: cobrado · Cobrado · Ganado |
| result.js:215 | Para ver cuánto ganas falta… | Para ver cuánto se gana falta… |
| result.js:106-115 | Trabajas… Te salen… Libras… te corresponden | Se trabajan… Salen… Se libran… corresponden |
| result.js:131 | lo que cobras en negro; lo que te ahorras; los km que te pagan | lo que se cobra en negro; lo que se ahorra; los km que se pagan |
| result.js:140-143 | no te retienen IRPF; te devolverían; de tu nómina | no se retiene IRPF; se devolverían; de la nómina |
| result.js:154-155 | que no disfrutas… te los pagan… lo que trabajas | que no se disfrutan… se pagan… lo que se trabaja |
| result.js:159-162 | Vas y vuelves… Subes… bajas… con tu coche | Ida y vuelta… Ida al empezar y vuelta al acabar; N bajadas a casa… con coche propio |
| explanations.js | «tú» branches | the existing third-person branch of each sentence |

## Comparar

| Where | Now | Proposed |
|---|---|---|
| compare.js:32,51 | Sin tus desplazamientos ni gastos | Sin desplazamientos ni gastos propios |
| compare.js:69 | Se comparan con las tuyas, sin tus… | Se comparan solo las condiciones, sin desplazamientos ni gastos propios. |
| compare.js:174-180 | Ganas por hora · Ganas · Cobras | Ganado por hora · Ganado · Cobrado |
| compare.js:215, 366 | Te deben / se le deben | Lo que debe el ganadero / Debe el ganadero X al mes |
| compare.js:379-483 | lo que ganas / ganas X | lo que se gana / se gana X |
| compare.js:529-532 | Dinero que cobras · Lo que ganas | Dinero cobrado · Ganado |

## Leyes, rights, legal, workings, negotiate (about 70 rows; pattern)

- «te corresponden» → «corresponden»; «te pagan» → «se paga(n)»; «te deben» → «debe el ganadero»; «libras / trabajas / cobras» → «se libran / se trabajan / se cobra»; «tu base / tu nómina / tu jubilación» → «la base / la nómina / la jubilación».
- index.html:90 «tu contrato o tu convenio pueden darte más» → «el contrato o el convenio pueden dar más».
- index.html:105 «Sin alta no cotizas… si te accidentas no estás cubierto.» → «Sin alta no se cotiza… en un accidente no hay cobertura.»
- index.html:107 «…tiene que volver a llamarte.» → «…tiene que volver a llamar al pastor.»
- index.html:124 «Es su margen para pagarte más.» → «Es el margen del ganadero para pagar más.»
- index.html:128 «Un sindicato… te puede asesorar» → «Un sindicato… puede asesorar».
- legal.js:92 «si te pones malo o te haces daño, no cobras» → «en caso de enfermedad o accidente, no se cobra».
- negotiate.js:57,68 «a tu costa» → «a costa del pastor».
- workings.js ledger rows: «= Te deben» → «= Debe el ganadero»; «− Te pagan en negro» → «− Se paga en negro»; «Festivos que trabajas» → «Festivos que se trabajan»; «Total que ganas» → «Total ganado».
- rights.js:118 «Márcalo en «Casa y comida»» → «Márcalo en «El día a día»».

## Ajustes

| Where | Now | Proposed |
|---|---|---|
| index.html:216 | Tus datos | Datos comunes |
| index.html:217 | …sino de ti… cámbialas si las tuyas son otras. | …sino de cada pastor… Se cambian si no son estas. |
| index.html:220 | Lo que te costaría un alquiler (€/mes) | Alquiler de referencia (€/mes) |
| index.html:220 | Si en una oferta te ponen casa, te ahorras esto… | Si en una oferta el ganadero pone casa, se ahorra esto… |
| index.html:221 | Lo que te cuesta cada comida (€) | Coste de cada comida (€) |
| index.html:232 | Tu coche | Coche |
| index.html:237 | …lo que cobras en el año… Lo de tus ofertas… | …lo que se cobra en el año… Lo de las ofertas… |
| settings-page.js | tus ofertas / Compartes… ves… | las ofertas / Se comparten… se ven… |
| backup.js:30 | «Tus datos» siguen como los tenías. | «Datos comunes» siguen como estaban. |

## Account and sign-in

| Where | Now | Proposed |
|---|---|---|
| index.html:53,151 | Cargando tu cuenta… | Cargando la cuenta… |
| index.html:154 | Con una cuenta, tus ofertas… Si compartes las tuyas… | Con una cuenta, las ofertas se guardan… Si se comparten, se comparan con las de otros pastores |
| index.html:176 | Tu perfil | Perfil |
| index.html:183 | Compartir tus ofertas | Compartir las ofertas |
| sign-in.js | Tu correo / o con tu correo | Correo / o con correo |
| account-tip.js | Guarda tus ofertas… si compartes tus ofertas, verás las suyas | Guarda las ofertas… si se comparten las ofertas, se ven las suyas |
| others.js:7-9 | todas tus ofertas, con tu nombre…; Si dejas de compartir, tus datos… | las ofertas, con el nombre, el correo y el teléfono; Si se deja de compartir, los datos dejan de verse… |
| others.js:48 | Añade un teléfono a tu perfil para que te puedan contactar. | Añade un teléfono al perfil para que puedan contactar. |

## Notices, backup, quips, templates

| Where | Now | Proposed |
|---|---|---|
| index.html:47 | Tus ofertas solo están guardadas… | Las ofertas solo están guardadas… |
| backup.js:41 | Se han tomado tus datos de la copia. | Se han tomado los datos de la copia. |
| ui/backup.js, events.js | Aquí la tienes… | Aquí está… |
| events.js:172,174 | Contigo hasta la majada / Mi pastor no se regala | see #6 above |
| offer.js:107-132 | Duermes en la borda; bajas cuando libras · cobras por día · vuelves cada día | see #10; «se cobra por día» · «ida y vuelta cada día» |
| text.js:190-191 | Duermes en borda / Tu coche / Sin tu coche | Se duerme en borda / Coche propio / Sin coche propio |
| text.js:296 | Ganas: X/hora (share card) | Ganado: X/hora |

## Glossary changes

- te pagan → lo que se paga (`terms.payAmount`, `totalAmount`, `cashAmount`)
- cobras → cobrado (`r.earnings.received`)
- ganas → se gana (headline, tags); ganado (rows); «solo lo que se gana» (`moneyOnly`)
- Lo que te pagan (step) → Pago (`STEPS` pay)
- Tus datos → Datos comunes (`cfg`; new entry)
- te deben → Lo que debe el ganadero (`r.debt.*`)
- Tu coche / Con mi coche → Coche propio (`mine.car = 'own'`)
- New steps: La oferta, El día a día, Coche y gastos
