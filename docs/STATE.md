# State

## Ajustes: your figures and choices only, and a backup with a structure

Decided with the owner on 31 October 2026, after a mock-up at 375 px. Record in ADR-0014 when done (law figures are not settings).
Work stays on branch `ccr-32fbee75-oc1p8v`; `master` is published only when the owner says so.

### Design

- «Tus datos» stays as it is: rent, meal prices, fuel consumption and price, car wear, other income in the year for IRPF.
- «Supuestos del cálculo» becomes «Cómo se cuenta», with only the two choices: «Contar casa y comida» and «Contar el paro que generas». Under them: «Las cifras de la ley (cotizaciones, pernocta, vacaciones, jornada anual) no se cambian aquí: salen de la ley vigente y se explican en «Leyes».»
- The law figures leave the settings: worker and employer contributions (`ssPct`, `ssEmp`), the overnight bonus (`overnightPct`), vacation days (`vacationDaysPerYear`), annual working hours (`annualHours`). The model, views and texts read them from `src/law.js`; the 1,826 annual hours moves there with its source. Values saved earlier under those keys are ignored (the owner's backup holds the law's values, so nothing changes for them).
- «Copia de seguridad»:
  - A status card first. Guest: when the last copy was made and whether offers changed since, plus that the browser can delete them; signed in: «Tus ofertas se guardan en tu cuenta.» and that a file is an extra backup. «Descargar copia» as the main button, «Copiar como texto» as a link.
  - «Recuperar una copia»: one drop area with «Elegir el archivo» that also takes a dropped file; pasting text folded under «Pegar el texto de una copia».
  - The result of an import in a visible box (success, partial, or not a backup), not a grey line.
- The reminder above the offers (no project configured) keeps working.

### Plan

1. Law figures out of the settings, read from `law.js`; «Cómo se cuenta». Unit and browser tests, the consistency spec included.
2. The backup section restructured, with the visible result. Browser tests.
3. ADR-0014; `docs/model.md` and `AGENTS.md` in line; screenshots for the owner; backlog the per-contract unemployment rate; then delete this section.
