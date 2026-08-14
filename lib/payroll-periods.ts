import type { Prisma } from "@/app/generated/prisma";
import { getVenezuelaParts, getVenezuelaDateString } from "@/lib/date-utils";

export type PeriodoTipo = "semana" | "quincena" | "mes" | "personalizado";

export const PERIODO_TIPOS: PeriodoTipo[] = ["semana", "quincena", "mes", "personalizado"];

export const PERIODO_LABELS: Record<PeriodoTipo, string> = {
  semana: "Semana",
  quincena: "15 días",
  mes: "Mes",
  personalizado: "Personalizado",
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ymd(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function diasEnMes(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

type Rango = { desde: string; hasta: string };

function capHastaToday(r: Rango, ref: Date): Rango {
  const todayStr = getVenezuelaDateString(ref);
  return {
    desde: r.desde > todayStr ? todayStr : r.desde,
    hasta: r.hasta > todayStr ? todayStr : r.hasta,
  };
}

/** Día actual (`ref`). */
export function rangoDia(ref: Date = new Date()): Rango {
  const d = ymd(ref.getFullYear(), ref.getMonth() + 1, ref.getDate());
  return capHastaToday({ desde: d, hasta: d }, ref);
}

/** Semana calendario actual (lunes a domingo) relativa a `ref`. */
export function rangoSemana(ref: Date = new Date()): Rango {
  const day = ref.getDay();
  const diffLunes = day === 0 ? -6 : 1 - day;
  const lunes = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diffLunes);
  const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);
  return capHastaToday({
    desde: ymd(lunes.getFullYear(), lunes.getMonth() + 1, lunes.getDate()),
    hasta: ymd(domingo.getFullYear(), domingo.getMonth() + 1, domingo.getDate()),
  }, ref);
}

/** Quincena del mes de `ref`: día 1-15 o 16-fin de mes, según la fecha actual. */
export function rangoQuincena(ref: Date = new Date()): Rango {
  const y = ref.getFullYear();
  const m = ref.getMonth() + 1;
  if (ref.getDate() <= 15) {
    return capHastaToday({ desde: ymd(y, m, 1), hasta: ymd(y, m, 15) }, ref);
  }
  return capHastaToday({ desde: ymd(y, m, 16), hasta: ymd(y, m, diasEnMes(y, m)) }, ref);
}

/** Mes calendario completo de `ref`. */
export function rangoMes(ref: Date = new Date()): Rango {
  const y = ref.getFullYear();
  const m = ref.getMonth() + 1;
  return capHastaToday({ desde: ymd(y, m, 1), hasta: ymd(y, m, diasEnMes(y, m)) }, ref);
}

export function rangoPorTipo(tipo: "dia" | "semana" | "quincena" | "mes", ref: Date = new Date()): Rango {
  if (tipo === "dia") return rangoDia(ref);
  if (tipo === "semana") return rangoSemana(ref);
  if (tipo === "quincena") return rangoQuincena(ref);
  return rangoMes(ref);
}

const MESES_ABR = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** Etiqueta legible de un rango de fechas ISO ("YYYY-MM-DD"), ej. "1 – 13 ago 2026". */
export function formatRangoLabel(desdeISO: string, hastaISO: string): string {
  const [ya, ma, da] = desdeISO.split("-").map(Number);
  const [yb, mb, db] = hastaISO.split("-").map(Number);
  if (ya === yb && ma === mb) {
    if (da === db) return `${da} ${MESES_ABR[ma - 1]} ${ya}`;
    return `${da} – ${db} ${MESES_ABR[ma - 1]} ${ya}`;
  }
  return `${da} ${MESES_ABR[ma - 1]} ${ya} – ${db} ${MESES_ABR[mb - 1]} ${yb}`;
}

/** Convierte un rango ISO ("YYYY-MM-DD") en límites de día en hora de Venezuela (00:00 – 23:59:59.999),
 * para usar contra `created_at` de órdenes. */
export function rangoADateTime(desdeISO: string, hastaISO: string): { inicio: Date; fin: Date } {
  const strInicio = desdeISO.length <= 10 ? desdeISO : desdeISO.slice(0, 10);
  const strFin = hastaISO.length <= 10 ? hastaISO : hastaISO.slice(0, 10);
  return {
    inicio: new Date(`${strInicio}T00:00:00.000-04:00`),
    fin: new Date(`${strFin}T23:59:59.999-04:00`),
  };
}

/** Filtro Prisma para las órdenes elegibles de nómina en el rango dado — misma condición
 * usada por el listado y por el endpoint de pago, para que nunca diverjan.
 *
 * `incluido_en_nomina_id: null` es lo que hace el corte real: una vez que una orden queda
 * ligada a un `PayrollRecord` pagado, deja de ser elegible para siempre, sin importar qué
 * rango de fechas se use después — así las ventas siguientes o pendientes acumuladas
 * se capturan sin riesgo de duplicar pagos. */
export function nominaEligibleWhere(inicio: Date, fin: Date, userId?: string): Prisma.OrderWhereInput {
  return {
    ...(userId ? { created_by: userId } : {}),
    status: "completada",
    created_at: { lte: fin },
    incluido_en_nomina_id: null,
  };
}
