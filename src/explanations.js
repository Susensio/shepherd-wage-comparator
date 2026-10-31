/** Explanations shown on tap, in one place so the pills and the breakdown say the same. */

import { fE } from './format.js';
import { LAW } from './law.js';
import { foodPerDay, mealsList, rentPerMonth } from './offer.js';

/** @param {boolean} [third] of another shepherd's offer: impersonal, never «tú» */
export function explanations(o, r, third = false) {
  const cfg = r.cfg;
  const severanceDays = `${LAW.severanceDaysPerYear} días de salario por año trabajado`;
  const contract = {
    temporary: `Contrato por temporada. Al acabar ${third ? 'le' : 'te'} corresponde una indemnización de ${severanceDays}${r.employer.severance > 0.5 ? `: unos ${fE(r.employer.severance)} brutos` : ''}.${r.min.casual ? ` Como dura ${LAW.casualMaxDays} días o menos, el mínimo es el de temporero: ${fE(r.wage.casual, 2)} por jornada.` : ''}`,
    seasonal: third
      ? 'Se trabaja por temporadas, pero el contrato sigue entre una y otra: la empresa tiene que volver a llamar cada campaña, en el orden que marque el convenio. Al acabar cada temporada no hay indemnización, y entre campañas se puede cobrar el paro si hay cotizado lo suficiente. Si no se llama, es un despido.'
      : 'Trabajas por temporadas, pero el contrato sigue entre una y otra: la empresa tiene que volver a llamarte cada campaña, en el orden que marque el convenio. Al acabar cada temporada no hay indemnización, y entre campañas puedes cobrar el paro si tienes cotizado lo suficiente. Si no te llaman, es un despido.',
    permanent: `Contrato indefinido todo el año. Si ${third ? 'se despide sin causa justificada le corresponden' : 'te despiden sin causa justificada te corresponden'} ${LAW.dismissalDaysPerYear} días de salario por año trabajado.`,
    none: third
      ? 'Trabajar sin contrato ni alta en la Seguridad Social es ilegal. No se cotiza: no se genera paro ni jubilación, y en un accidente no hay cobertura. La responsabilidad es del ganadero, no de quien trabaja.'
      : 'Trabajar sin contrato ni alta en la Seguridad Social es ilegal. No cotizas: no generas paro ni jubilación, y si te accidentas no estás cubierto. La responsabilidad es del ganadero, no tuya.',
  };
  const housingNote = third
    ? ` Se cuenta como ${fE(rentPerMonth(o.mine, cfg))} al mes que se ahorran, lo que costaría un alquiler.`
    : ` Se cuenta como ${fE(rentPerMonth(o.mine, cfg))} al mes que te ahorras, lo que te costaría un alquiler. Lo cambias para todas en «Tus datos», o solo para esta en «Casa y comida».`;
  const foodNote = third
    ? ` Se ahorran unos ${fE(foodPerDay(o.terms, cfg))} por día trabajado.`
    : ` Te ahorras unos ${fE(foodPerDay(o.terms, cfg))} por día trabajado. El precio de cada comida lo cambias en «Tus datos».`;
  return {
    housing: `${third ? 'Se pone casa' : 'Te ponen casa'}.${cfg.inKind ? housingNote : ''}`,
    food: `${third ? `Se dan ${mealsList(o.terms)}` : `Te dan ${mealsList(o.terms)}`}.${cfg.inKind ? foodNote : ''}`,
    b: third
      ? 'Lo que se cobra en negro cuenta como dinero, pero no cotiza: no da paro, jubilación ni baja, ni cuenta para la indemnización.'
      : 'Lo que cobras en negro cuenta como dinero, pero no cotiza: no da paro, jubilación ni baja, ni cuenta para la indemnización.',
    allPayroll: third
      ? 'Todo lo que se cobra va en nómina y cotiza: cuenta para el paro, la jubilación, la baja y la indemnización.'
      : 'Todo lo que cobras va en nómina y cotiza: cuenta para el paro, la jubilación, la baja y la indemnización.',
    severance: `Al acabar un contrato temporal ${third ? 'le' : 'te'} corresponde una indemnización de ${severanceDays} (Estatuto de los Trabajadores, art. 49.1.c). Va en el finiquito.`,
    contract: contract[o.terms.contract],
  };
}
