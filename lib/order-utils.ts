import { getVenezuelaCompactDateString } from "@/lib/date-utils";

/** Returns a short display reference like #190-001 from ORD-20240619-0001 */
export function shortOrderNumber(orderNumber: string): string {
  const digits = orderNumber.replace(/\D/g, "").slice(-6).padStart(6, "0");
  return `#${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function normalizeReference(ref: string): string {
  return ref.toUpperCase().replace(/[\s\-]/g, "");
}

/** Expresa una cantidad de unidades en docenas, ej. 48 -> "4 doc", 50 -> "4 doc + 2" */
export function formatDocenas(unidades: number): string {
  const docenas = Math.floor(unidades / 12);
  const resto = unidades % 12;
  return resto === 0 ? `${docenas} doc` : `${docenas} doc + ${resto}`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateOrderNumber(tx: any, customPrefix = "ORD"): Promise<string> {
  const now = new Date();
  const dateStr = getVenezuelaCompactDateString(now);
  const prefix = `${customPrefix}-${dateStr}-`;

  // Find the order created today with the highest sequence number
  const lastOrder = await tx.order.findFirst({
    where: {
      order_number: { startsWith: prefix },
    },
    orderBy: { order_number: "desc" },
    select: { order_number: true },
  });

  let nextSeq = 1;
  if (lastOrder?.order_number) {
    const parts = lastOrder.order_number.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }

  // Ensure candidate does not collide with any existing record
  let candidate = `${prefix}${String(nextSeq).padStart(4, "0")}`;
  let exists = await tx.order.findUnique({
    where: { order_number: candidate },
    select: { id: true },
  });

  while (exists) {
    nextSeq++;
    candidate = `${prefix}${String(nextSeq).padStart(4, "0")}`;
    exists = await tx.order.findUnique({
      where: { order_number: candidate },
      select: { id: true },
    });
  }

  return candidate;
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

export function getPaymentTypeLabel(payment: {
  payment_type: string;
  notes?: string | null;
  reference?: string | null;
}): string {
  if (payment.payment_type === "transferencia") {
    const isPanama =
      payment.notes?.toLowerCase().includes("panama") ||
      payment.reference?.toLowerCase().includes("panama");
    if (isPanama) return "Banesco Panamá";
    return "Transferencia";
  }
  return PAYMENT_TYPE_LABELS[payment.payment_type] || payment.payment_type;
}

export function isWebOrder(order: {
  notes?: string | null;
  order_number?: string | null;
  created_by?: string | null;
  creator?: { name: string; lastname?: string | null } | null;
}): boolean {
  return Boolean(
    order.order_number?.toUpperCase().startsWith("WEB-") ||
    order.notes?.includes("[Correo Web") ||
    order.notes?.includes("Venta Web") ||
    (!order.created_by && !order.creator)
  );
}

export function getOrderChannelDisplay(order: {
  channel?: string | null;
  notes?: string | null;
  order_number?: string | null;
  created_by?: string | null;
  creator?: { name: string; lastname?: string | null } | null;
}): {
  label: "WEB" | "Online" | "Tienda";
  vendedora: string;
  badgeClass: string;
} {
  if (isWebOrder(order)) {
    return {
      label: "WEB",
      vendedora: "Cliente Web",
      badgeClass: "bg-purple-100 text-purple-800 border-purple-200 font-semibold",
    };
  }

  if (order.channel === "online") {
    const seller = order.creator
      ? `${order.creator.name} ${order.creator.lastname || ""}`.trim()
      : "Vendedora Online";
    return {
      label: "Online",
      vendedora: seller,
      badgeClass: "bg-blue-50 text-blue-700 border-blue-200 font-medium",
    };
  }

  const seller = order.creator
    ? `${order.creator.name} ${order.creator.lastname || ""}`.trim()
    : "Vendedora Tienda";
  return {
    label: "Tienda",
    vendedora: seller,
    badgeClass: "bg-gray-100 text-gray-700 border-gray-200 font-medium",
  };
}
