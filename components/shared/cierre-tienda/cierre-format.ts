export const TIPO_CIERRE_LABELS: Record<string, string> = {
  diario: "Diario",
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
};

export const MONEDA_CLASSES: Record<string, string> = {
  BCV: "bg-blue-100 text-blue-800",
  DIVISAS: "bg-emerald-100 text-emerald-800",
  MIXTO: "bg-amber-100 text-amber-800",
};

/** Convierte un Date a "YYYY-MM-DD" en hora LOCAL (no usar toISOString: en zonas UTC-N
 * corre la fecha un día para horas cercanas a medianoche). Para poblar <input type="date">. */
export function dateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatFechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-VE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-VE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** "ORD-20260701-0001" -> "#260701-0001" (año sin siglo + secuencia, tal como se usa en
 * las tablas de Cierre de Tienda). */
export function formatNumeroOrdenCorto(orderNumber: string): string {
  const match = orderNumber.match(/(\d{8})-(\d+)$/);
  if (!match) return orderNumber;
  const [, fecha, secuencia] = match;
  return `#${fecha.slice(2)}-${secuencia}`;
}
