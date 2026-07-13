import { STATUS_LABELS, PAYMENT_TYPE_LABELS } from "@/lib/order-utils";

export type OrderAuditLogEntry = {
  id: string;
  action: string;
  data_before: unknown;
  data_after: unknown;
  created_at: Date;
  user: { id: string; name: string };
};

export type FormattedAuditEntry = {
  title: string;
  details: string[];
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

function statusLabel(s: unknown): string {
  return typeof s === "string" ? (STATUS_LABELS[s] ?? s) : "—";
}

function money(n: unknown): string {
  const num = Number(n);
  return isNaN(num) ? "—" : `$${num.toFixed(2)}`;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/** Formats an AuditLog row (entity_type "Order" or "OrderShipment") into a readable Spanish entry. */
export function formatOrderAuditEntry(log: OrderAuditLogEntry): FormattedAuditEntry {
  const before = asRecord(log.data_before);
  const after = asRecord(log.data_after);

  switch (log.action) {
    case "CREATE": {
      const channel = after.channel === "online" ? "Online" : "Tienda";
      return {
        title: "Orden creada",
        details: [`Canal: ${channel}`, `Estado inicial: ${statusLabel(after.status)}`, `Total: ${money(after.total_usd)}`],
      };
    }
    case "pago_agregado": {
      const type = str(after.payment_type);
      const details = [`${type ? PAYMENT_TYPE_LABELS[type] ?? type : "Pago"} · ${money(after.amount_usd)}`];
      if (after.auto_verified) details.push("Verificado automáticamente (efectivo)");
      const ref = str(after.reference);
      if (ref && ref !== "EFECTIVO") details.push(`Referencia: ${ref}`);
      return { title: "Pago agregado", details };
    }
    case "pago_verificado": {
      const details: string[] = [];
      if (after.paid_usd != null) details.push(`Pagado: ${money(after.paid_usd)}`);
      return { title: "Pago verificado", details };
    }
    case "pago_individual_verificado": {
      return {
        title: "Pago individual verificado",
        details: [
          `Acumulado: ${money(after.total_paid)} / ${money(after.total_usd)}`,
          "Aún no cubría el total — la orden no avanzó de estado con este pago",
        ],
      };
    }
    case "estado_actualizado": {
      return { title: `Estado actualizado: ${statusLabel(before.status)} → ${statusLabel(after.status)}`, details: [] };
    }
    case "pago_rechazado": {
      const motivo = str(after.motivo);
      return { title: "Pago(s) rechazado(s)", details: motivo ? [`Motivo: ${motivo}`] : [] };
    }
    case "pago_individual_rechazado": {
      const motivo = str(after.motivo);
      return { title: "Pago individual rechazado", details: motivo ? [`Motivo: ${motivo}`] : [] };
    }
    case "producto_agregado": {
      const items = Array.isArray(after.items_added)
        ? (after.items_added as Array<{ name: string; size: string; quantity: number }>)
        : [];
      const details = items.map((i) => `• ${i.name} talla ${i.size} ×${i.quantity}`);
      details.push(`Total: ${money(before.total_usd)} → ${money(after.total_usd)}`);
      if (after.repriced_existing_items) {
        details.push("Se recalcularon los precios de los productos ya existentes según la nueva cantidad total");
      }
      return {
        title: after.was_reopened ? "Orden reabierta y producto(s) agregado(s)" : "Producto(s) agregado(s)",
        details,
      };
    }
    case "CANCEL": {
      return { title: "Orden cancelada", details: [`Estado anterior: ${statusLabel(before.status)}`] };
    }
    case "FORCE_CANCEL": {
      const motivo = str(after.motivo);
      const details = [`Estado anterior: ${statusLabel(before.status)}`];
      if (motivo) details.push(`Motivo: ${motivo}`);
      return { title: "Orden cancelada por devolución", details };
    }
    case "enviada": {
      const details = ["Marcada como enviada"];
      const tracking = str(after.tracking);
      if (tracking) details.push(`Tracking: ${tracking}`);
      return { title: "Enviada", details };
    }
    case "completada": {
      return { title: "Completada", details: [] };
    }
    case "embalaje_fotos_editadas": {
      return { title: "Fotos de embalaje editadas", details: [] };
    }
    default:
      return { title: log.action, details: [] };
  }
}
