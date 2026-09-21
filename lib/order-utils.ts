import { getVenezuelaCompactDateString } from "@/lib/date-utils";

/** Returns a short display reference like #190-001 from ORD-20240619-0001 */
export function shortOrderNumber(orderNumber: string): string {
  const digits = orderNumber.replace(/\D/g, "").slice(-6).padStart(6, "0");
  return `#${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function normalizeReference(ref: string): string {
  return ref.toUpperCase().replace(/[\s\-]/g, "");
}

export function isCashPaymentType(paymentType: string): boolean {
  const norm = (paymentType || "").toLowerCase();
  return norm === "efectivo_bs" || norm === "efectivo_usd" || norm.includes("efectivo");
}

export function isZellePaymentType(paymentType: string): boolean {
  return (paymentType || "").toLowerCase().includes("zelle");
}

export function validatePaymentReference(
  paymentType: string,
  reference?: string | null
): { valid: boolean; error?: string } {
  if (isCashPaymentType(paymentType)) {
    return { valid: true };
  }

  const cleanRef = (reference ?? "").trim();
  if (!cleanRef) {
    return { valid: false, error: "La referencia es requerida para este método de pago" };
  }

  if (isZellePaymentType(paymentType)) {
    if (cleanRef.length < 6 || cleanRef.length > 20) {
      return { valid: false, error: "El número de referencia de Zelle debe tener entre 6 y 20 caracteres" };
    }
  } else {
    if (cleanRef.length !== 8) {
      return { valid: false, error: "El número de referencia debe tener exactamente los últimos 8 dígitos" };
    }
  }

  return { valid: true };
}

export function getPaymentReferenceConfig(paymentType: string): {
  required: boolean;
  label: string;
  placeholder: string;
  maxLength: number;
  hint: string;
} {
  if (isCashPaymentType(paymentType)) {
    return {
      required: false,
      label: "Referencia (opcional)",
      placeholder: "N/A para efectivo",
      maxLength: 30,
      hint: "",
    };
  }

  if (isZellePaymentType(paymentType)) {
    return {
      required: true,
      label: "N° de Referencia de Pago (6 a 20 dígitos) *",
      placeholder: "Ej. 1234567890",
      maxLength: 20,
      hint: "Entre 6 y 20 caracteres",
    };
  }

  return {
    required: true,
    label: "Últimos 8 dígitos de la referencia *",
    placeholder: "Ej. 12345678",
    maxLength: 8,
    hint: "Exactamente los últimos 8 dígitos",
  };
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

export function isWebStorePickup(order: {
  notes?: string | null;
  order_number?: string | null;
  created_by?: string | null;
  creator?: { name: string; lastname?: string | null } | null;
  address?: string | null;
  shipping_company?: string | null;
  channel?: string | null;
}): boolean {
  if (!isWebOrder(order)) return false;

  const sc = (order.shipping_company || "").toLowerCase().trim();
  const addr = (order.address || "").toLowerCase().trim();
  const notes = (order.notes || "").toLowerCase().trim();

  const hasRetiroKeyword = (str: string) =>
    str.includes("retiro") ||
    str.includes("pickup") ||
    str.includes("retirar en tienda") ||
    str.includes("retira en tienda") ||
    str.includes("retiro por tienda");

  return (
    hasRetiroKeyword(sc) ||
    hasRetiroKeyword(addr) ||
    hasRetiroKeyword(notes)
  );
}

export function getOrderChannelDisplay(order: {
  channel?: string | null;
  notes?: string | null;
  order_number?: string | null;
  created_by?: string | null;
  creator?: { name: string; lastname?: string | null } | null;
  address?: string | null;
  shipping_company?: string | null;
}): {
  label: string;
  vendedora: string;
  badgeClass: string;
  isWeb: boolean;
  isWebPickup: boolean;
  rowHighlightClass: string;
} {
  if (isWebStorePickup(order)) {
    return {
      label: "Web - Retiro en tienda",
      vendedora: "Cliente Web",
      badgeClass: "bg-red-100 text-red-800 border-red-300 font-semibold",
      isWeb: true,
      isWebPickup: true,
      rowHighlightClass: "border-l-4 border-l-red-500 bg-red-50/40 hover:bg-red-50/70",
    };
  }

  if (isWebOrder(order)) {
    return {
      label: "Web",
      vendedora: "Cliente Web",
      badgeClass: "bg-purple-100 text-purple-800 border-purple-200 font-medium",
      isWeb: true,
      isWebPickup: false,
      rowHighlightClass: "",
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
      isWeb: false,
      isWebPickup: false,
      rowHighlightClass: "",
    };
  }

  const seller = order.creator
    ? `${order.creator.name} ${order.creator.lastname || ""}`.trim()
    : "Vendedora Tienda";
  return {
    label: "Tienda",
    vendedora: seller,
    badgeClass: "bg-gray-100 text-gray-700 border-gray-200 font-medium",
    isWeb: false,
    isWebPickup: false,
    rowHighlightClass: "",
  };
}

export type OrderCustomerContact = {
  phone: string | null;
  email: string | null;
};

/**
 * Resolves phone and email for an order from its relations (Customer / CustomerAccount),
 * order notes, or fallback DB queries (by customer_id, customer_account_id, customer_id_doc, or email).
 */
export async function resolveOrderCustomerContact(
  order: {
    customer_id?: string | null;
    customer_account_id?: string | null;
    customer_id_doc?: string | null;
    notes?: string | null;
    customer?: { phone?: string | null; email?: string | null } | null;
    customer_account?: { phone?: string | null; email?: string | null } | null;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prismaClient?: any
): Promise<OrderCustomerContact> {
  let phone = order.customer?.phone?.trim() || order.customer_account?.phone?.trim() || null;
  let email = order.customer?.email?.trim() || order.customer_account?.email?.trim() || null;

  // Extract email or phone from notes if not present
  if (!email && order.notes) {
    const emailMatch = order.notes.match(/\[Correo Web:\s*([^\]]+)\]/i);
    if (emailMatch && emailMatch[1]) {
      email = emailMatch[1].trim();
    }
  }

  if (!phone && order.notes) {
    const phoneMatch = order.notes.match(/\[(?:Teléfono|Telefono|Phone)(?:\s*Web)?:\s*([^\]]+)\]/i);
    if (phoneMatch && phoneMatch[1]) {
      phone = phoneMatch[1].trim();
    }
  }

  // If we already found both phone and email, return directly
  if (phone && email) {
    return { phone, email };
  }

  // If prismaClient is provided and we still lack phone or email, do fallback lookups
  if (prismaClient) {
    try {
      // 1. Check customer_account_id if not included
      if ((!phone || !email) && order.customer_account_id && !order.customer_account) {
        const account = await prismaClient.customerAccount.findUnique({
          where: { id: order.customer_account_id },
          select: { phone: true, email: true },
        });
        if (account) {
          if (!phone && account.phone?.trim()) phone = account.phone.trim();
          if (!email && account.email?.trim()) email = account.email.trim();
        }
      }

      // 2. Check customer_id if not included
      if ((!phone || !email) && order.customer_id && !order.customer) {
        const cust = await prismaClient.customer.findUnique({
          where: { id: order.customer_id },
          select: { phone: true, email: true },
        });
        if (cust) {
          if (!phone && cust.phone?.trim()) phone = cust.phone.trim();
          if (!email && cust.email?.trim()) email = cust.email.trim();
        }
      }

      // 3. Fallback by customer_id_doc
      if ((!phone || !email) && order.customer_id_doc) {
        const rawDoc = order.customer_id_doc.trim();
        const docMatch = rawDoc.match(/^([VPJE])[- ]?(\d+)$/i);
        const digitsOnly = rawDoc.replace(/\D/g, "");

        if (docMatch) {
          const doc_type = docMatch[1].toUpperCase();
          const doc_number = docMatch[2];

          const cust = await prismaClient.customer.findUnique({
            where: { doc_type_doc_number: { doc_type, doc_number } },
            select: { phone: true, email: true },
          });
          if (cust) {
            if (!phone && cust.phone?.trim()) phone = cust.phone.trim();
            if (!email && cust.email?.trim()) email = cust.email.trim();
          }

          if (!phone || !email) {
            const acc = await prismaClient.customerAccount.findFirst({
              where: { doc_number },
              select: { phone: true, email: true },
            });
            if (acc) {
              if (!phone && acc.phone?.trim()) phone = acc.phone.trim();
              if (!email && acc.email?.trim()) email = acc.email.trim();
            }
          }
        } else if (digitsOnly) {
          const cust = await prismaClient.customer.findFirst({
            where: { doc_number: digitsOnly },
            select: { phone: true, email: true },
          });
          if (cust) {
            if (!phone && cust.phone?.trim()) phone = cust.phone.trim();
            if (!email && cust.email?.trim()) email = cust.email.trim();
          }

          if (!phone || !email) {
            const acc = await prismaClient.customerAccount.findFirst({
              where: { doc_number: digitsOnly },
              select: { phone: true, email: true },
            });
            if (acc) {
              if (!phone && acc.phone?.trim()) phone = acc.phone.trim();
              if (!email && acc.email?.trim()) email = acc.email.trim();
            }
          }
        }
      }

      // 4. Fallback by email (if email is known but phone is missing)
      if (!phone && email) {
        const acc = await prismaClient.customerAccount.findUnique({
          where: { email },
          select: { phone: true },
        });
        if (acc?.phone?.trim()) {
          phone = acc.phone.trim();
        } else {
          const cust = await prismaClient.customer.findFirst({
            where: { email: { equals: email, mode: "insensitive" } },
            select: { phone: true },
          });
          if (cust?.phone?.trim()) {
            phone = cust.phone.trim();
          }
        }
      }
    } catch {
      // Ignore fallback lookup errors
    }
  }

  return {
    phone: phone || null,
    email: email || null,
  };
}

