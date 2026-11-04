/** The steps an offer is entered in, in order, and the one that holds each thing `missing()` can report. */

/**
 * `label` names the step's row in the ficha's «Condiciones» (none for the templates, which are not a condition);
 * `summary` lists the keys of `summaries()` that row reads. The title, the row and the fieldset share one name.
 */
export const STEPS = [
  { id: 'template', title: '¿Se parece a alguna de estas?' },
  { id: 'offer', title: 'La oferta', label: 'La oferta', summary: ['place', 'when'] },
  { id: 'pay', title: 'Pago', label: 'Pago', summary: ['pay', 'irpf'] },
  { id: 'day', title: 'El día a día', label: 'El día a día', summary: ['workday', 'housing'] },
  { id: 'trip', title: 'Coche y gastos', label: 'Coche y gastos', summary: ['car', 'expenses'] },
];

/** The steps shown as «Condiciones». */
export const CONDITION_STEPS = STEPS.filter((step) => step.label);

/** The step where each thing `missing()` reports is filled in. */
export const STEP_OF_MISSING = {
  agreedTotal: 'pay',
  duration: 'offer',
  hoursPerDay: 'day',
  pay: 'pay',
  cashInHand: 'pay',
  payrollPart: 'pay',
  vacation: 'pay',
};
