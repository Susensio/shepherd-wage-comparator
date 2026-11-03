/** The steps an offer is entered in, in order, and the one that holds each thing `missing()` can report. */

/**
 * `label` names the step's row in the ficha's «Condiciones» (none for the templates, which are not a condition);
 * `summary` is the key of `summaries()` that row reads.
 */
export const STEPS = [
  { id: 'template', title: '¿Se parece a alguna de estas?' },
  { id: 'place', title: '¿Dónde es?', label: 'Dónde', summary: 'place' },
  { id: 'when', title: '¿Cuándo y cuánto tiempo?', label: 'Cuándo', summary: 'when' },
  { id: 'pay', title: '¿Cuánto te pagan?', label: 'Pago', summary: 'pay' },
  { id: 'workday', title: 'Jornada y libranzas', label: 'Jornada', summary: 'workday' },
  { id: 'home', title: 'Casa y comida', label: 'Casa y comida', summary: 'housing' },
  { id: 'trip', title: '¿Cómo llegas?', label: 'Viaje', summary: 'car' },
  { id: 'expenses', title: 'Tus gastos y el IRPF', label: 'Gastos e IRPF', summary: 'others' },
];

/** The steps shown as «Condiciones». */
export const CONDITION_STEPS = STEPS.filter((step) => step.label);

/** The step where each thing `missing()` reports is filled in. */
export const STEP_OF_MISSING = {
  agreedTotal: 'pay',
  duration: 'when',
  hoursPerDay: 'workday',
  pay: 'pay',
  cashInHand: 'pay',
  payrollPart: 'pay',
  vacation: 'pay',
};
