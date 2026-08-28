export interface ParsedWhatsAppItem {
  quantity: number;
  productName: string;
  subtotalUsd: number;
  unitPriceUsd: number;
  size: string;
  color?: string | null;
  tierTag?: string | null; // ej: "Docena", "Mayor", "Detal"
}

export interface ParsedWhatsAppCustomer {
  customer_name: string;
  customer_lastname: string;
  doc_type: "V" | "P" | "J" | "E";
  doc_number: string;
  phone: string;
  address: string;
  shipping_company: string;
  payment_method: string; // ej: "zelle", "pago_movil", "efectivo_usd", "transferencia", etc.
}

export interface ParsedWhatsAppOrder {
  items: ParsedWhatsAppItem[];
  customer: ParsedWhatsAppCustomer;
  totalUsd: number;
  rawText: string;
}

export function parseWhatsAppOrderMessage(text: string): ParsedWhatsAppOrder {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const items: ParsedWhatsAppItem[] = [];
  const customer: ParsedWhatsAppCustomer = {
    customer_name: "",
    customer_lastname: "",
    doc_type: "V",
    doc_number: "",
    phone: "",
    address: "",
    shipping_company: "",
    payment_method: "zelle",
  };

  let totalUsd = 0;
  let inCustomerSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect separator lines
    if (line.includes("_________") || line.includes("----------")) {
      if (items.length > 0 || totalUsd > 0) {
        inCustomerSection = true;
      }
      continue;
    }

    // 1. Detect Total line
    const totalMatch = line.match(/\*?(?:🏺|Total USD:?)\s*(?:Total USD:?)?\s*\$?([\d.]+)\*?/i);
    if (totalMatch && totalMatch[1]) {
      totalUsd = parseFloat(totalMatch[1]);
      inCustomerSection = true;
      continue;
    }

    // 2. Parse Items section
    // Pattern: *_6x - Xoxo Garza Azul Rey dama ($19.98)_* or *6x - Xoxo Garza ($19.98)*
    const itemHeaderMatch = line.match(/^\*?_?(\d+)\s*x\s*-\s*(.+?)\s*\(\$([\d.]+)\)_?\*?$/i);
    if (itemHeaderMatch) {
      const quantity = parseInt(itemHeaderMatch[1], 10);
      const productName = itemHeaderMatch[2].trim();
      const subtotalUsd = parseFloat(itemHeaderMatch[3]);
      const unitPriceUsd = quantity > 0 ? parseFloat((subtotalUsd / quantity).toFixed(2)) : subtotalUsd;

      let size = "UNIQUE";
      let color: string | null = null;
      let tierTag: string | null = null;

      // Check next line for details (Talla: UNIQUE | Color: Azul [Docena])
      if (i + 1 < lines.length && lines[i + 1].includes("Talla:")) {
        const detailLine = lines[i + 1];
        i++; // skip next line in main loop

        // Talla
        const tallaMatch = detailLine.match(/Talla:\s*([^|\[]+)/i);
        if (tallaMatch) {
          size = tallaMatch[1].trim();
        }

        // Color
        const colorMatch = detailLine.match(/Color:\s*([^|\[]+)/i);
        if (colorMatch) {
          color = colorMatch[1].trim();
        }

        // Tier tag [Docena] or [Mayor] or [Detal]
        const tierMatch = detailLine.match(/\[(.*?)\]/);
        if (tierMatch) {
          tierTag = tierMatch[1].trim();
        }
      }

      items.push({
        quantity,
        productName,
        subtotalUsd,
        unitPriceUsd,
        size,
        color,
        tierTag,
      });
      continue;
    }

    // 3. Customer Info Section
    if (inCustomerSection || line.startsWith("📞") || line.startsWith("🆔") || line.startsWith("📍") || line.startsWith("💵")) {
      // Phone
      if (line.startsWith("📞")) {
        const rawPhone = line.replace("📞", "").trim();
        const digits = rawPhone.replace(/\D/g, "");
        if (digits.startsWith("58") && digits.length > 10) {
          customer.phone = `0${digits.slice(2)}`;
        } else if (digits.length === 9 || digits.length === 10) {
          customer.phone = digits.startsWith("0") ? digits : `0${digits}`;
        } else {
          customer.phone = digits;
        }
        continue;
      }

      // ID Doc
      if (line.startsWith("🆔")) {
        const idMatch = line.match(/🆔\s*([VPEJvpej])[\s\-]*(\d+)/i);
        if (idMatch) {
          customer.doc_type = idMatch[1].toUpperCase() as "V" | "P" | "J" | "E";
          customer.doc_number = idMatch[2].trim();
        }
        continue;
      }

      // Shipping & Address
      if (line.startsWith("📍")) {
        const shipInfo = line.replace("📍", "").trim();
        if (shipInfo.includes(":")) {
          const parts = shipInfo.split(":");
          customer.shipping_company = parts[0].trim();
          customer.address = parts.slice(1).join(":").trim();
        } else if (shipInfo.includes("-")) {
          const parts = shipInfo.split("-");
          customer.shipping_company = parts[0].trim();
          customer.address = parts.slice(1).join("-").trim();
        } else {
          customer.shipping_company = "MRW";
          customer.address = shipInfo;
        }
        continue;
      }

      // Payment method
      if (line.startsWith("💵")) {
        const payStr = line.replace("💵", "").trim().toLowerCase();
        if (payStr.includes("zelle")) customer.payment_method = "zelle";
        else if (payStr.includes("movil") || payStr.includes("móvil")) customer.payment_method = "pago_movil";
        else if (payStr.includes("efectivo") && payStr.includes("bs")) customer.payment_method = "efectivo_bs";
        else if (payStr.includes("efectivo") || payStr.includes("usd") || payStr.includes("divisas")) customer.payment_method = "efectivo_usd";
        else if (payStr.includes("transferencia") || payStr.includes("banesco")) customer.payment_method = "transferencia";
        else if (payStr.includes("usdt") || payStr.includes("binance")) customer.payment_method = "usdt";
        else customer.payment_method = payStr;
        continue;
      }

      // Name line (bold format *Nombre Apellido* without special characters/emojis)
      const nameMatch = line.match(/^\*?([A-Za-zÁÉÍÓÚáéíóúÑñ\s]{2,})\*?$/);
      if (
        nameMatch &&
        !customer.customer_name &&
        !line.includes("Resumen") &&
        !line.includes("Total") &&
        !line.includes("Q´ FRANELAS") &&
        !line.includes("Por favor")
      ) {
        const fullName = nameMatch[1].trim();
        const parts = fullName.split(/\s+/);
        customer.customer_name = parts[0] || "";
        customer.customer_lastname = parts.slice(1).join(" ") || "";
        continue;
      }
    }
  }

  return {
    items,
    customer,
    totalUsd: totalUsd || items.reduce((sum, item) => sum + item.subtotalUsd, 0),
    rawText: text,
  };
}
