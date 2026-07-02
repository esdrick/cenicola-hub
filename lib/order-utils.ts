/** Returns a short display reference like #190-001 from ORD-20240619-0001 */
export function shortOrderNumber(orderNumber: string): string {
  const digits = orderNumber.replace(/\D/g, "").slice(-6).padStart(6, "0");
  return `#${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function normalizeReference(ref: string): string {
  return ref.toUpperCase().replace(/[\s\-]/g, "");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateOrderNumber(tx: any): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const dateStr = `${y}${m}${d}`;

  const dayStart = new Date(y, now.getMonth(), now.getDate());
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const count: number = await tx.order.count({
    where: { created_at: { gte: dayStart, lt: dayEnd } },
  });
  return `ORD-${dateStr}-${String(count + 1).padStart(4, "0")}`;
}

export const STATUS_LABELS: Record<string, string> = {
  pendiente_pago:  "Pendiente pago",
  pago_parcial:    "Pago parcial",
  pago_verificado: "Pago verificado",
  en_embalaje:     "En embalaje",
  enviada:         "Enviada",
  completada:      "Completada",
  cancelada:       "Cancelada",
};

export const STATUS_CLASSES: Record<string, string> = {
  pendiente_pago:  "bg-yellow-100 text-yellow-800",
  pago_parcial:    "bg-orange-100 text-orange-800",
  pago_verificado: "bg-blue-100 text-blue-800",
  en_embalaje:     "bg-purple-100 text-purple-800",
  enviada:         "bg-sky-100 text-sky-800",
  completada:      "bg-emerald-100 text-emerald-800",
  cancelada:       "bg-red-100 text-red-700",
};

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  efectivo_bs:   "Efectivo BS",
  efectivo_usd:  "Efectivo USD",
  transferencia: "Transferencia",
  zelle:         "Zelle",
  pago_movil:    "Pago Móvil",
  usdt:          "USDT",
};
