/** Explanations shown on tap, in one place so the pills and the breakdown say the same. */

import { fE } from './format.js';
import { LAW } from './law.js';
import { foodPerDay, mealsList, rentPerMonth } from './offer.js';

export function explanations(o, r) {
  const cfg = r.cfg;
  const severanceDays = `${LAW.severanceDaysPerYear} días de salario por año trabajado`;
  const contract = {
    temporary: `Contrato por temporada. Al acabar corresponde una indemnización de ${severanceDays}${r.employer.severance > 0.5 ? `: unos ${fE(r.employer.severance)} brutos` : ''}.${r.min.casual ? ` Como dura ${LAW.casualMaxDays} días o menos, el mínimo es el de temporero: ${fE(r.wage.casual, 2)} por jornada.` : ''}`,
    seasonal:
      'Se trabaja por temporadas, pero el contrato sigue entre una y otra: el ganadero tiene que volver a llamar cada campaña, en el orden que marque el convenio. Al acabar cada temporada no hay indemnización, y entre campañas se puede cobrar el paro si hay cotizado lo suficiente. Si no se llama, es un despido.',
    permanent: `Contrato indefinido todo el año. Si se despide sin causa justificada corresponden ${LAW.dismissalDaysPerYear} días de salario por año trabajado.`,
    none: 'Trabajar sin contrato ni alta en la Seguridad Social es ilegal. No se cotiza: no se genera paro ni jubilación, y en un accidente no hay cobertura. La responsabilidad es del ganadero, no de quien trabaja.',
    selfEmployed:
      'Como autónomo se factura al ganadero y se paga la propia cuota de autónomos. No hay vacaciones pagadas ni indemnización; en vez del paro, se cotiza para el cese de actividad, y el IRPF va por módulos. Si se trabaja con el ganado del ganadero, en sus pastos y a sus órdenes, la ley lo trata como trabajo asalariado: puede ser un falso autónomo (Estatuto de los Trabajadores, art. 1.1 y 8.1).',
  };
  const housingNote = ` Se cuenta como ${fE(rentPerMonth(o.mine, cfg))} al mes que se ahorran, lo que costaría un alquiler.`;
  const foodNote = ` Se ahorran unos ${fE(foodPerDay(o.terms, cfg))} por día trabajado.`;
  return {
    housing: `Se pone casa.${cfg.inKind ? housingNote : ''}`,
    food: `Se dan ${mealsList(o.terms)}.${cfg.inKind ? foodNote : ''}`,
    b: 'Lo que se cobra en negro cuenta como dinero, pero no cotiza: no da paro, jubilación ni baja, ni cuenta para la indemnización.',
    allPayroll:
      'Todo lo que se cobra va en nómina y cotiza: cuenta para el paro, la jubilación, la baja y la indemnización.',
    severance: `Al acabar un contrato temporal corresponde una indemnización de ${severanceDays} (Estatuto de los Trabajadores, art. 49.1.c). Va en el finiquito.`,
    contract: contract[o.terms.contract],
  };
}
