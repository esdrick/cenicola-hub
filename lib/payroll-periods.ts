import type { Prisma } from "@/app/generated/prisma";

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

/** Día actual (`ref`). */
export function rangoDia(ref: Date): Rango {
  const d = ymd(ref.getFullYear(), ref.getMonth() + 1, ref.getDate());
  return { desde: d, hasta: d };
}

/** Semana calendario actual (lunes a domingo) relativa a `ref`. */
export function rangoSemana(ref: Date): Rango {
  const day = ref.getDay();
  const diffLunes = day === 0 ? -6 : 1 - day;
  const lunes = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + diffLunes);
  const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);
  return {
    desde: ymd(lunes.getFullYear(), lunes.getMonth() + 1, lunes.getDate()),
    hasta: ymd(domingo.getFullYear(), domingo.getMonth() + 1, domingo.getDate()),
  };
}

/** Quincena del mes de `ref`: día 1-15 o 16-fin de mes, según la fecha actual. */
export function rangoQuincena(ref: Date): Rango {
  const y = ref.getFullYear();
  const m = ref.getMonth() + 1;
  if (ref.getDate() <= 15) {
    return { desde: ymd(y, m, 1), hasta: ymd(y, m, 15) };
  }
  return { desde: ymd(y, m, 16), hasta: ymd(y, m, diasEnMes(y, m)) };
}

/** Mes calendario completo de `ref`. */
export function rangoMes(ref: Date): Rango {
  const y = ref.getFullYear();
  const m = ref.getMonth() + 1;
  return { desde: ymd(y, m, 1), hasta: ymd(y, m, diasEnMes(y, m)) };
}

export function rangoPorTipo(tipo: "dia" | "semana" | "quincena" | "mes", ref: Date): Rango {
  if (tipo === "dia") return rangoDia(ref);
  if (tipo === "semana") return rangoSemana(ref);
  if (tipo === "quincena") return rangoQuincena(ref);
  return rangoMes(ref);
}

const MESES_ABR = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** Etiqueta legible de un rango de fechas ISO ("YYYY-MM-DD"), ej. "1 – 15 jul 2026". */
export function formatRangoLabel(desdeISO: string, hastaISO: string): string {
  const [ya, ma, da] = desdeISO.split("-").map(Number);
  const [yb, mb, db] = hastaISO.split("-").map(Number);
  if (ya === yb && ma === mb) {
    return `${da} – ${db} ${MESES_ABR[ma - 1]} ${ya}`;
  }
  return `${da} ${MESES_ABR[ma - 1]} ${ya} – ${db} ${MESES_ABR[mb - 1]} ${yb}`;
}

/** Convierte un rango ISO ("YYYY-MM-DD") en límites de día local (00:00 – 23:59:59.999),
 * para usar contra `created_at` de órdenes. */
export function rangoADateTime(desdeISO: string, hastaISO: string): { inicio: Date; fin: Date } {
  const [y1, m1, d1] = desdeISO.split("-").map(Number);
  const [y2, m2, d2] = hastaISO.split("-").map(Number);
  return {
    inicio: new Date(y1, m1 - 1, d1),
    fin: new Date(y2, m2 - 1, d2, 23, 59, 59, 999),
  };
}

/** Filtro Prisma para las órdenes elegibles de nómina en el rango dado — misma condición
 * usada por el listado y por el endpoint de pago, para que nunca diverjan. `userId` solo
 * se incluye cuando el filtro va suelto (no anidado bajo la relación `orders_created` de
 * un `User`, que ya implica el vendedor).
 *
 * `incluido_en_nomina_id: null` es lo que hace el corte real: una vez que una orden queda
 * ligada a un `PayrollRecord` pagado, deja de ser elegible para siempre, sin importar qué
 * rango de fechas se use después — así las ventas siguientes arrancan limpias. */
export function nominaEligibleWhere(inicio: Date, fin: Date, userId?: string): Prisma.OrderWhereInput {
  return {
    ...(userId ? { created_by: userId } : {}),
    status: "completada",
    created_at: { gte: inicio, lte: fin },
    incluido_en_nomina_id: null,
  };
}
