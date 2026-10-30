/** Explanations shown on tap, in one place so the pills and the breakdown say the same. */

import { fE } from './format.js';
import { LAW } from './law.js';
import { foodPerDay, mealsList, rentPerMonth } from './offer.js';

export function explanations(o, r) {
  const cfg = r.cfg;
  const severanceDays = `${LAW.severanceDaysPerYear} días de salario por año trabajado`;
  const contract = {
    temporary: `Contrato por temporada. Al acabar te toca una indemnización de ${severanceDays}${r.employer.severance > 0.5 ? `: unos ${fE(r.employer.severance)} brutos` : ''}.${r.min.casual ? ` Como dura ${LAW.casualMaxDays} días o menos, el mínimo es el de temporero: ${fE(r.wage.casual, 2)} por jornada.` : ''}`,
    seasonal:
      'Trabajas por temporadas, pero el contrato sigue entre una y otra: la empresa tiene que volver a llamarte cada campaña, en el orden que marque el convenio. Al acabar cada temporada no hay indemnización, y entre campañas puedes cobrar el paro si tienes cotizado lo suficiente. Si no te llaman, es un despido.',
    permanent: `Contrato indefinido todo el año. Si te despiden sin causa justificada te corresponden ${LAW.dismissalDaysPerYear} días de salario por año trabajado.`,
    none: 'Trabajar sin contrato ni alta en la Seguridad Social es ilegal. No cotizas: no generas paro ni jubilación, y si te accidentas no estás cubierto. La responsabilidad es del ganadero, no tuya.',
  };
  return {
    housing: `Te ponen casa.${cfg.inKind ? ` Se cuenta como ${fE(rentPerMonth(o, cfg))} al mes que te ahorras, lo que te costaría un alquiler. Lo cambias para todas en «Tus datos», o solo para esta en «Casa y comida».` : ''}`,
    food: `Te dan ${mealsList(o)}.${cfg.inKind ? ` Te ahorras unos ${fE(foodPerDay(o, cfg))} por día trabajado. El precio de cada comida lo cambias en «Tus datos».` : ''}`,
    b: 'Lo que cobras en negro cuenta como dinero, pero no cotiza: no da paro, jubilación ni baja, ni cuenta para la indemnización.',
    allPayroll:
      'Todo lo que cobras va en nómina y cotiza: cuenta para el paro, la jubilación, la baja y la indemnización.',
    severance: `Al acabar un contrato temporal te toca una indemnización de ${severanceDays} (Estatuto de los Trabajadores, art. 49.1.c). Va en el finiquito.`,
    contract: contract[o.contract],
  };
}
