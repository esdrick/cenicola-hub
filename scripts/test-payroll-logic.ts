import {
  rangoMes,
  rangoQuincena,
  rangoSemana,
  rangoADateTime,
  nominaEligibleWhere,
} from "../lib/payroll-periods";
import { getVenezuelaParts, getVenezuelaDateString } from "../lib/date-utils";

console.log("--- Testing Payroll Logic & Smart Ranges ---");

const todayStr = getVenezuelaDateString();
console.log("Today in Venezuela:", todayStr);

const rMes = rangoMes();
console.log("Default Month Range (rangoMes):", rMes);

const rQuincena = rangoQuincena();
console.log("Default Quincena Range (rangoQuincena):", rQuincena);

const rSemana = rangoSemana();
console.log("Default Semana Range (rangoSemana):", rSemana);

const { inicio, fin } = rangoADateTime(rMes.desde, rMes.hasta);
console.log("DateTime Range -> inicio:", inicio.toISOString(), "fin:", fin.toISOString());

const filter = nominaEligibleWhere(inicio, fin, "user-123");
console.log("Prisma Filter (nominaEligibleWhere):", JSON.stringify(filter, null, 2));

// Assertions
const statusIn = (filter.status as any)?.in;
if (
  rMes.hasta === todayStr &&
  filter.incluido_en_nomina_id === null &&
  Array.isArray(statusIn) &&
  statusIn.includes("enviada") &&
  statusIn.includes("completada") &&
  "updated_at" in filter &&
  "lte" in (filter.updated_at as any)
) {
  console.log("✅ SUCCESS: Payroll logic correctly includes enviada/completada, uses smart today cutoff, and strict anti-duplicate lock!");
} else {
  console.error("❌ FAILURE: Payroll logic assertion failed!", rMes, filter);
  process.exit(1);
}
