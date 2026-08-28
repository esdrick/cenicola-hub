import { formatDocenas } from "./order-utils";

interface WhatsAppCartItem {
  name: string;
  size: string;
  color?: string | null;
  quantity: number;
  unit_price: number;
}

interface GenerateWhatsAppMessageOptions {
  customerName: string;
  phone?: string | null;
  items: WhatsAppCartItem[];
  totalUsd: number;
  bcvRate: number;
  companyPhone?: string; // Número de WhatsApp configurado en el sistema
  pricingMethod?: "bcv" | "divisas";
  paymentType?: string;
}

/**
 * Genera el mensaje formateado para enviar la orden por WhatsApp para asesoría personalizada.
 */
export function generateWhatsAppOrderUrl({
  customerName,
  items,
  totalUsd,
  bcvRate,
  companyPhone = "584141234567", // Fallback por defecto si no hay número en DB
  pricingMethod = "bcv",
  paymentType,
}: GenerateWhatsAppMessageOptions): string {
  const cleanPhone = companyPhone.replace(/\D/g, "");

  const cleanPayment = (paymentType || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const isDivisasPayment = ["zelle", "usdt", "panama", "banco_panama", "efectivo_usd", "divisas"].some((m) =>
    cleanPayment.includes(m)
  );

  const isDivisas = pricingMethod === "divisas" || isDivisasPayment;
  const totalVes = (totalUsd * bcvRate).toFixed(2);

  let message = `*¡Hola! Quisiera realizar un pedido con asesoría en Cenicola*\n\n`;
  message += `👤 *Cliente:* ${customerName}\n`;

  if (isDivisas) {
    message += `💵 *Modalidad de Pago:* Divisas (USD)\n\n`;
  } else {
    message += `💵 *Tasa BCV del día:* Bs. ${bcvRate.toFixed(2)}\n\n`;
  }

  message += `📦 *Detalle del Carrito:*\n`;

  items.forEach((item, idx) => {
    const docenasTxt = formatDocenas(item.quantity);
    const subtotalUsd = (item.quantity * item.unit_price).toFixed(2);
    message += `${idx + 1}. *${item.name}* (${item.size}${item.color ? ` - ${item.color}` : ""})\n`;
    message += `   • Cantidad: ${item.quantity} unds (${docenasTxt})\n`;
    message += `   • Subtotal: $${subtotalUsd}\n`;
  });

  message += `\n💰 *Total Estimado:*\n`;
  message += `• *USD:* $${totalUsd.toFixed(2)}\n`;

  if (isDivisas) {
    message += `• *Total en Divisas:* $${totalUsd.toFixed(2)} USD\n\n`;
  } else {
    message += `• *Bolívares (BCV):* Bs. ${totalVes}\n\n`;
  }

  message += `Quedo a la espera para coordinar el pago y envío. ¡Muchas gracias!`;

  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}
