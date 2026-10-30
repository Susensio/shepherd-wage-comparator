'use strict';

/* ---------- Spanish-era data ----------
   Until October 2026 the code, and so the saved data, used Spanish names. Everything read from the browser, the cloud
   or a backup file goes through these functions first, so old data keeps working. */
const LEGACY = {
  offerFields: {"nombre": "name", "meses": "duration", "durUnidad": "durationUnit", "horasDia": "hoursPerDay", "libranzas": "daysOff", "libUnidad": "daysOffUnit", "festivos": "holidays", "aTipo": "payType", "aCantidad": "payAmount", "aUnidad": "payUnit", "extras": "extraPays", "vacaciones": "vacation", "bCantidad": "cashAmount", "bUnidad": "cashUnit", "contrato": "contract", "pernocta": "overnight", "casa": "housing", "casaValor": "rentValue", "comDes": "mealBreakfast", "comAlm": "mealSnack", "comMed": "mealLunch", "comCen": "mealDinner", "coche": "car", "vuelta": "commute", "bajadas": "tripsHome", "kmCasa": "kmHome", "kmTrabajoDia": "kmWorkPerDay", "kmPagado": "kmRate", "gastos": "expenses", "irpfModo": "irpfMode", "inicio": "start", "anio": "year", "soloOferta": "offerOnly", "bModo": "cashMode", "nomMin": "payrollMin", "totCantidad": "totalAmount", "totUnidad": "totalUnit", "vacAuto": "vacationAuto", "vacBruto": "vacationGross", "diasSemana": "legacyDaysPerWeek", "viajesSemana": "legacyTripsPerWeek", "especie": "legacyInKind", "comida": "food", "bloque": "block", "vecesMes": "legacyTimesPerMonth", "comidaValor": "legacyMealValue", "reparto": "legacySplit", "consumo": "fuelUse", "precioL": "fuelPrice", "desgaste": "wear", "diasVacAnio": "vacationDaysPerYear", "comDesP": "mealBreakfastP", "comAlmP": "mealSnackP", "comMedP": "mealLunchP", "comCenP": "mealDinnerP"},
  offerValues: {"durationUnit": {"meses": "months", "dias": "days", "nose": "unknown"}, "daysOffUnit": {"semana": "week", "mes": "month"}, "holidays": {"si": "yes"}, "overnight": {"si": "yes"}, "housing": {"si": "yes"}, "food": {"si": "yes", "parcial": "partial"}, "payType": {"bruto": "gross", "neto": "net"}, "payUnit": {"dia": "day", "mes": "month", "anio": "year"}, "cashUnit": {"dia": "day", "mes": "month"}, "totalUnit": {"dia": "day", "mes": "month"}, "extraPays": {"incluidas": "included", "aparte": "separate"}, "vacation": {"incluidas": "included", "disfruto": "taken", "finiquito": "paidAtEnd"}, "contract": {"temporal": "temporary", "fijodisc": "seasonal", "fijo": "permanent", "ninguno": "none"}, "car": {"propio": "own", "empresa_todo": "noCar", "empresa_trabajo": "legacyCompanyCar"}, "commute": {"diario": "daily", "vivo": "liveIn", "libranza": "legacyOnDaysOff", "nunca": "legacyNever"}, "cashMode": {"pongo": "amount"}},
  cfgFields: {"paro": "unemployment", "otros": "others", "esp": "inKind", "horasAnuales": "annualHours", "pernoctaPct": "overnightPct", "casaValor": "rentValue", "comDesP": "mealBreakfastP", "comAlmP": "mealSnackP", "comMedP": "mealLunchP", "comCenP": "mealDinnerP", "consumo": "fuelUse", "precioL": "fuelPrice", "desgaste": "wear", "diasVacAnio": "vacationDaysPerYear"},
  folds: {"desglose2": "breakdown2", "roja": "owed", "ley-jorn": "law-days", "ley-horas": "law-hours", "coste": "cost", "leyes": "laws", "cuentas": "workings", "nominas": "payslips", "tiempo": "time", "nomina": "payroll", "casa": "housing", "coche": "car", "otros": "others", "desglose": "breakdown"},
  tabs: {"ofertas": "offers", "comparar": "compare", "leyes": "laws", "ajustes": "settings"},
  units: {"hora": "hour", "dia": "day", "mes": "month"},
};
const renameKeys = (obj,map)=>Object.fromEntries(Object.entries(obj||{}).map(([k,v])=>[map[k]??k,v]));
/** An offer saved with Spanish field names and values, in today's names. Offers already in English are returned as they are. */
function offerFromSpanish(o){
  if(!o||!('nombre' in o||'durUnidad' in o||'horasDia' in o)) return o;
  const x=renameKeys(o,LEGACY.offerFields);
  for(const [k,vals] of Object.entries(LEGACY.offerValues)) if(x[k] in vals) x[k]=vals[x[k]];
  return x;
}
const cfgFromSpanish = c=>c&&('consumo' in c||'esp' in c||'horasAnuales' in c)?renameKeys(c,LEGACY.cfgFields):c;
/** A saved bundle ({ofertas,cfg} or {offers,cfg}: backups and the cloud document) in today's names. */
const bundleFromSpanish = d=>!d||typeof d!=='object'?d:{...d,offers:d.offers??d.ofertas,cfg:cfgFromSpanish(d.cfg)};
