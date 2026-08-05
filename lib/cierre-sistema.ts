import { prisma } from "@/lib/prisma";

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

/** Parsea la fecha de corte recibida del formulario ("YYYY-MM-DD") y la normaliza al
 * inicio del día local. Devuelve null si es inválida o cae en el futuro — un corte
 * nunca puede fecharse por adelantado. */
export function parseFechaCorte(fechaRaw: unknown): Date | null {
  if (typeof fechaRaw !== "string") return null;
  const fecha = new Date(fechaRaw.length <= 10 ? `${fechaRaw}T00:00:00` : fechaRaw);
  if (Number.isNaN(fecha.getTime())) return null;
  const inicio = startOfDay(fecha);
  if (inicio.getTime() > startOfDay(new Date()).getTime()) return null;
  return inicio;
}

/** Corte de sistema activo: el registro más reciente, o null si nunca se ha
 * confirmado uno. Fuente única de verdad para el piso de fecha por defecto en
 * Ventas/Pagos/Envíos — mientras sea null, esas vistas se comportan exactamente
 * igual que antes de este feature. */
export async function getCorteActivo(): Promise<Date | null> {
  const ultimo = await prisma.cierreSistema.findFirst({ orderBy: { created_at: "desc" } });
  return ultimo?.fecha_corte ?? null;
}
