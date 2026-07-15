import type { Prisma } from "@/app/generated/prisma";
import type { TipoCierre, OrderChannel } from "@/app/generated/prisma/client";
import { PAYMENT_TYPE_LABELS } from "@/lib/order-utils";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Parsea fechaInicio/fechaFin recibidos por query/body (strings "YYYY-MM-DD" de un
 * <input type="date">, o ISO completos) y los normaliza a los límites del día local.
 * Devuelve null si alguna fecha es inválida o el rango está invertido. */
export function parseRangoFechas(fechaInicioRaw: unknown, fechaFinRaw: unknown): RangoFechas | null {
  if (typeof fechaInicioRaw !== "string" || typeof fechaFinRaw !== "string") return null;
  const inicio = new Date(fechaInicioRaw.length <= 10 ? `${fechaInicioRaw}T00:00:00` : fechaInicioRaw);
  const fin = new Date(fechaFinRaw.length <= 10 ? `${fechaFinRaw}T00:00:00` : fechaFinRaw);
  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return null;
  const fechaInicio = startOfDay(inicio);
  const fechaFin = endOfDay(fin);
  if (fechaInicio.getTime() > fechaFin.getTime()) return null;
  return { fechaInicio, fechaFin };
}

function diasEnMes(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}

export type RangoFechas = { fechaInicio: Date; fechaFin: Date };

/** Calcula el rango [fechaInicio, fechaFin] (límites de día incluidos) para un tipo de
 * cierre, relativo a `fechaReferencia`. `offset` desplaza el período hacia atrás (negativo)
 * o adelante (positivo) en unidades del propio tipo — ej. offset=-1 en SEMANAL da la semana
 * anterior. Es solo un pre-llenado: el admin puede ajustar fechaInicio/fechaFin después. */
export function calcularRangoFechas(
  tipo: TipoCierre,
  fechaReferencia: Date = new Date(),
  offset = 0,
): RangoFechas {
  if (tipo === "diario") {
    const ref = new Date(fechaReferencia.getFullYear(), fechaReferencia.getMonth(), fechaReferencia.getDate() + offset);
    return { fechaInicio: startOfDay(ref), fechaFin: endOfDay(ref) };
  }

  if (tipo === "semanal") {
    const day = fechaReferencia.getDay();
    const diffLunes = day === 0 ? -6 : 1 - day;
    const lunes = new Date(
      fechaReferencia.getFullYear(),
      fechaReferencia.getMonth(),
      fechaReferencia.getDate() + diffLunes + offset * 7,
    );
    const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);
    return { fechaInicio: startOfDay(lunes), fechaFin: endOfDay(domingo) };
  }

  if (tipo === "quincenal") {
    // Cada "unidad" de offset es media quincena (15/16 días).
    let y = fechaReferencia.getFullYear();
    let m = fechaReferencia.getMonth() + 1;
    let primeraMitad = fechaReferencia.getDate() <= 15;

    let steps = offset;
    while (steps !== 0) {
      if (steps > 0) {
        if (primeraMitad) {
          primeraMitad = false;
        } else {
          primeraMitad = true;
          m += 1;
          if (m > 12) { m = 1; y += 1; }
        }
        steps -= 1;
      } else {
        if (!primeraMitad) {
          primeraMitad = true;
        } else {
          primeraMitad = false;
          m -= 1;
          if (m < 1) { m = 12; y -= 1; }
        }
        steps += 1;
      }
    }

    if (primeraMitad) {
      return { fechaInicio: startOfDay(new Date(y, m - 1, 1)), fechaFin: endOfDay(new Date(y, m - 1, 15)) };
    }
    return { fechaInicio: startOfDay(new Date(y, m - 1, 16)), fechaFin: endOfDay(new Date(y, m - 1, diasEnMes(y, m))) };
  }

  // mensual
  const y = fechaReferencia.getFullYear();
  const m = fechaReferencia.getMonth() + 1 + offset;
  const base = new Date(y, m - 1, 1);
  const by = base.getFullYear();
  const bm = base.getMonth() + 1;
  return {
    fechaInicio: startOfDay(new Date(by, bm - 1, 1)),
    fechaFin: endOfDay(new Date(by, bm - 1, diasEnMes(by, bm))),
  };
}

/** Status elegibles para cierre: la orden ya tiene el pago confirmado y no fue cancelada. */
export const ESTATUS_ELEGIBLES_CIERRE = ["pago_verificado", "en_embalaje", "enviada", "completada"] as const;

/** Selección de columnas/relaciones necesaria para construir las filas de un cierre —
 * compartida entre el preview (GET) y la creación (POST) para no duplicar la query. */
export const cierreOrderInclude = {
  items: { select: { quantity: true } },
  payments: {
    where: { status: { not: "rechazado" } },
    orderBy: { created_at: "asc" },
    select: { payment_type: true, reference: true },
  },
} satisfies Prisma.OrderInclude;

export type CierreEligibleOrder = Prisma.OrderGetPayload<{ include: typeof cierreOrderInclude }>;

/** Filtro Prisma para las órdenes elegibles de un cierre en el rango y canal dados — misma
 * condición usada por el preview y por la creación real, para que nunca diverjan. Un cierre
 * siempre es de un solo canal (tienda u online) — nunca mezcla ambos. */
export function cierreEligibleWhere(fechaInicio: Date, fechaFin: Date, canal: OrderChannel): Prisma.OrderWhereInput {
  return {
    channel: canal,
    pago_verificado_at: { gte: fechaInicio, lte: fechaFin },
    status: { in: [...ESTATUS_ELEGIBLES_CIERRE] },
    incluido_en_cierre_id: null,
  };
}

export type CierreRow = {
  orderId: string;
  numeroOrden: string;
  clienteNombre: string;
  fechaConfirmacion: Date;
  cantidadPiezas: number;
  monto: number;
  moneda: string;
  metodoPago: string;
  referencia: string;
};

export type ResumenTotal = { moneda: string; metodoPago: string; monto: number };

function pickMoneda(
  order: Pick<CierreEligibleOrder, "total_bcv_usd" | "total_divisas_usd" | "pricing_method">,
): string {
  const bcv = Number(order.total_bcv_usd);
  const divisas = Number(order.total_divisas_usd);
  if (bcv > 0 && divisas > 0) return "MIXTO";
  if (divisas > 0) return "DIVISAS";
  if (bcv > 0) return "BCV";
  // Legacy fallback for any row whose bucket totals never got backfilled.
  return (order.pricing_method ?? "bcv").toUpperCase();
}

function pickMetodoPago(order: Pick<CierreEligibleOrder, "payments">): string {
  const metodos = new Set(order.payments.map((p) => p.payment_type));
  if (metodos.size === 0) return "N/A";
  if (metodos.size > 1) return "Mixto";
  const tipo = [...metodos][0];
  return PAYMENT_TYPE_LABELS[tipo] ?? tipo;
}

function pickReferencia(order: Pick<CierreEligibleOrder, "payments">): string {
  const referencias = new Set(order.payments.map((p) => p.reference));
  if (referencias.size === 0) return "N/A";
  return [...referencias].join(" + ");
}

/** Convierte cada orden elegible en la fila denormalizada de cierre (misma forma usada
 * tanto en el preview en vivo como al congelar el snapshot en CierreTiendaDetalle). */
export function buildCierreRows(orders: CierreEligibleOrder[]): CierreRow[] {
  return orders.map((order) => ({
    orderId: order.id,
    numeroOrden: order.order_number,
    clienteNombre: `${order.customer_name} ${order.customer_lastname}`.trim(),
    fechaConfirmacion: order.pago_verificado_at as Date,
    cantidadPiezas: order.items.reduce((s, i) => s + i.quantity, 0),
    monto: Number(order.total_usd),
    moneda: pickMoneda(order),
    metodoPago: pickMetodoPago(order),
    referencia: pickReferencia(order),
  }));
}

/** Total de piezas + desglose agrupado por (moneda, método de pago). */
export function buildResumen(rows: CierreRow[]): { totalPiezas: number; resumenTotales: ResumenTotal[] } {
  const totalPiezas = rows.reduce((s, r) => s + r.cantidadPiezas, 0);

  const grupos = new Map<string, ResumenTotal>();
  for (const row of rows) {
    const key = `${row.moneda}::${row.metodoPago}`;
    const existing = grupos.get(key);
    if (existing) {
      existing.monto = parseFloat((existing.monto + row.monto).toFixed(2));
    } else {
      grupos.set(key, { moneda: row.moneda, metodoPago: row.metodoPago, monto: row.monto });
    }
  }

  return { totalPiezas, resumenTotales: [...grupos.values()].sort((a, b) => b.monto - a.monto) };
}
