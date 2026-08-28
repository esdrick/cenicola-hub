import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";
import { parseWhatsAppOrderMessage } from "@/lib/whatsapp-parser";
import { generateOrderNumber } from "@/lib/order-utils";
import { getVenezuelaDateString } from "@/lib/date-utils";
import { getTasa } from "@/lib/tasa-cambio";
import { getSetting } from "@/lib/settings";
import { paymentTypeToPricingMethod } from "@/lib/pricing";
import type { PaymentType } from "@/app/generated/prisma/client";

function parsePaymentType(paymentMethodRaw: string): PaymentType {
  const payStr = (paymentMethodRaw || "zelle").toLowerCase();
  if (payStr.includes("movil") || payStr.includes("móvil")) return "pago_movil";
  if (payStr.includes("efectivo") && payStr.includes("bs")) return "efectivo_bs";
  if (payStr.includes("efectivo") || payStr.includes("usd") || payStr.includes("divisas")) return "efectivo_usd";
  if (payStr.includes("transferencia") || payStr.includes("banesco")) return "transferencia";
  if (payStr.includes("usdt") || payStr.includes("binance")) return "usdt";
  return "zelle";
}

function getOfficialCatalogUnitPrice(
  v: {
    price_bcv: { toNumber(): number } | number;
    price_divisas: { toNumber(): number } | number;
    price_bundle_bcv: { toNumber(): number } | number;
    price_bundle_divisas: { toNumber(): number } | number;
    price_mayor_bcv: { toNumber(): number } | number;
    price_mayor_divisas: { toNumber(): number } | number;
  },
  quantity: number,
  tierTag?: string | null,
  paymentType: PaymentType = "zelle",
  bundleThreshold = 3,
  mayorThreshold = 6
): number {
  const method = paymentTypeToPricingMethod(paymentType);

  const pBcv = typeof v.price_bcv === "number" ? v.price_bcv : v.price_bcv.toNumber();
  const pDivisasRaw = typeof v.price_divisas === "number" ? v.price_divisas : v.price_divisas.toNumber();
  const pDivisas = pDivisasRaw > 0 ? pDivisasRaw : pBcv;

  const pBundleBcvRaw = typeof v.price_bundle_bcv === "number" ? v.price_bundle_bcv : v.price_bundle_bcv.toNumber();
  const pBundleDivisasRaw = typeof v.price_bundle_divisas === "number" ? v.price_bundle_divisas : v.price_bundle_divisas.toNumber();

  const pMayorBcvRaw = typeof v.price_mayor_bcv === "number" ? v.price_mayor_bcv : v.price_mayor_bcv.toNumber();
  const pMayorDivisasRaw = typeof v.price_mayor_divisas === "number" ? v.price_mayor_divisas : v.price_mayor_divisas.toNumber();

  const pBundleBcv = pBundleBcvRaw > 0 ? pBundleBcvRaw : pBcv;
  const pBundleDivisas = pBundleDivisasRaw > 0 ? pBundleDivisasRaw : pDivisas;

  const pMayorBcv = pMayorBcvRaw > 0 ? pMayorBcvRaw : pBundleBcv;
  const pMayorDivisas = pMayorDivisasRaw > 0 ? pMayorDivisasRaw : pBundleDivisas;

  const tag = (tierTag || "").toLowerCase();

  if (method === "bcv") {
    if (tag.includes("mayor") || quantity >= mayorThreshold) return pMayorBcv;
    if (tag.includes("docena") || tag.includes("bundle") || tag.includes("paquete") || quantity >= bundleThreshold) return pBundleBcv;
    return pBcv;
  } else {
    if (tag.includes("mayor") || quantity >= mayorThreshold) return pMayorDivisas;
    if (tag.includes("docena") || tag.includes("bundle") || tag.includes("paquete") || quantity >= bundleThreshold) return pBundleDivisas;
    return pDivisas;
  }
}

// POST /api/orders/parse-whatsapp
export async function POST(request: NextRequest) {
  // Restricted strictly to admin and inventario roles
  const auth = await withRole(["admin", "inventario"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body || !body.rawText) {
    return NextResponse.json({ error: "Mensaje de WhatsApp requerido" }, { status: 400 });
  }

  const channel = (body.channel === "tienda" ? "tienda" : "online") as "online" | "tienda";
  const parsed = parseWhatsAppOrderMessage(body.rawText);

  if (parsed.items.length === 0) {
    return NextResponse.json({ error: "No se pudieron identificar ítems de pedido en el texto proporcionado" }, { status: 400 });
  }

  const cust = body.customer || parsed.customer;
  const paymentType = parsePaymentType(cust.payment_method);

  const [mayorThreshold, bundleThreshold] = await Promise.all([
    getSetting("mayor_threshold"),
    getSetting("bundle_threshold"),
  ]);

  // Process items and match against DB products & variants
  const matchedItems = await Promise.all(
    parsed.items.map(async (item, idx) => {
      // Allow overriding variant selection from client request payload if provided
      const clientOverrideVariantId = body.overrideVariants?.[idx];

      if (clientOverrideVariantId) {
        const overrideVar = await prisma.productVariant.findUnique({
          where: { id: clientOverrideVariantId },
          include: { product: { select: { id: true, name: true, color: true, photos: true } } },
        });
        if (overrideVar) {
          const stock = channel === "online" ? overrideVar.stock_online : overrideVar.stock_store;
          const officialUnitPrice = getOfficialCatalogUnitPrice(
            overrideVar,
            item.quantity,
            item.tierTag,
            paymentType,
            bundleThreshold,
            mayorThreshold
          );
          const officialSubtotal = parseFloat((officialUnitPrice * item.quantity).toFixed(2));
          const isTampered = Math.abs(officialSubtotal - item.subtotalUsd) > 0.10;

          return {
            ...item,
            unitPriceUsd: officialUnitPrice,
            subtotalUsd: officialSubtotal,
            officialUnitPrice,
            officialSubtotalUsd: officialSubtotal,
            parsedUnitPrice: item.unitPriceUsd,
            parsedSubtotalUsd: item.subtotalUsd,
            isPriceTampered: isTampered,
            matchedVariant: {
              id: overrideVar.id,
              product_id: overrideVar.product.id,
              product_name: overrideVar.product.name,
              size: overrideVar.size,
              color: overrideVar.product.color,
              stock,
              price_divisas: officialUnitPrice,
              price_bcv: Number(overrideVar.price_bcv),
              photo: overrideVar.product.photos[0],
            },
            matchStatus: isTampered ? ("price_tampered" as const) : ("exact" as const),
          };
        }
      }

      // Clean product search query
      const searchTerms = item.productName
        .replace(/dama|caballero|niño|niña|unisex/gi, "")
        .trim();

      // Find candidates by product name
      const candidateProducts = await prisma.product.findMany({
        where: {
          is_active: true,
          OR: [
            { name: { contains: item.productName, mode: "insensitive" } },
            { name: { contains: searchTerms, mode: "insensitive" } },
          ],
        },
        include: {
          variants: {
            where: { is_active: true },
          },
        },
        take: 10,
      });

      let matchedVariant: {
        id: string;
        product_id: string;
        product_name: string;
        size: string;
        color: string | null;
        stock: number;
        price_divisas: number;
        price_bcv: number;
        photo?: string;
      } | null = null;

      let matchStatus: "exact" | "partial" | "price_tampered" | "not_found" = "not_found";
      let officialUnitPrice = 0;
      let isTampered = false;

      const candidateList: Array<{
        id: string;
        product_id: string;
        product_name: string;
        size: string;
        color: string | null;
        stock: number;
        price_divisas: number;
        price_bcv: number;
      }> = [];

      for (const p of candidateProducts) {
        for (const v of p.variants) {
          const stock = channel === "online" ? v.stock_online : v.stock_store;
          const candidateOfficialPrice = getOfficialCatalogUnitPrice(
            v,
            item.quantity,
            item.tierTag,
            paymentType,
            bundleThreshold,
            mayorThreshold
          );

          const candidateObj = {
            id: v.id,
            product_id: p.id,
            product_name: p.name,
            size: v.size,
            color: p.color,
            stock,
            price_divisas: candidateOfficialPrice,
            price_bcv: Number(v.price_bcv),
          };
          candidateList.push(candidateObj);

          // Size equality check
          const sizeMatch = v.size.trim().toLowerCase() === item.size.trim().toLowerCase();
          const colorMatch =
            !item.color ||
            !p.color ||
            p.color.trim().toLowerCase() === item.color.trim().toLowerCase() ||
            item.productName.toLowerCase().includes(p.color.toLowerCase());

          if (sizeMatch && colorMatch) {
            matchedVariant = {
              ...candidateObj,
              photo: p.photos[0],
            };
            officialUnitPrice = candidateOfficialPrice;
            const officialSubtotal = parseFloat((officialUnitPrice * item.quantity).toFixed(2));
            isTampered = Math.abs(officialSubtotal - item.subtotalUsd) > 0.10;
            matchStatus = isTampered ? "price_tampered" : "exact";
            break;
          } else if (sizeMatch && !matchedVariant) {
            matchedVariant = {
              ...candidateObj,
              photo: p.photos[0],
            };
            officialUnitPrice = candidateOfficialPrice;
            const officialSubtotal = parseFloat((officialUnitPrice * item.quantity).toFixed(2));
            isTampered = Math.abs(officialSubtotal - item.subtotalUsd) > 0.10;
            matchStatus = "partial";
          }
        }
        if (matchStatus === "exact" || matchStatus === "price_tampered") break;
      }

      const effectiveUnitPrice = matchedVariant ? officialUnitPrice : item.unitPriceUsd;
      const officialSubtotalUsd = parseFloat((effectiveUnitPrice * item.quantity).toFixed(2));

      return {
        ...item,
        unitPriceUsd: effectiveUnitPrice,
        subtotalUsd: officialSubtotalUsd,
        officialUnitPrice,
        officialSubtotalUsd,
        parsedUnitPrice: item.unitPriceUsd,
        parsedSubtotalUsd: item.subtotalUsd,
        isPriceTampered: isTampered,
        matchedVariant,
        matchStatus,
        candidateVariants: candidateList,
      };
    })
  );

  const realTotalUsd = parseFloat(
    matchedItems.reduce((sum, i) => sum + i.officialSubtotalUsd, 0).toFixed(2)
  );
  const isAnyPriceTampered = matchedItems.some((i) => i.isPriceTampered);

  // ACTION 1: DIRECT ORDER CREATION
  if (body.action === "create_order") {
    const validItems = matchedItems.filter((i) => i.matchedVariant);
    if (validItems.length === 0) {
      return NextResponse.json(
        { error: "Ningún producto seleccionado coincide con la base de datos para crear la orden" },
        { status: 400 }
      );
    }

    // STRICT ANTI-FRAUD GUARD: Block direct creation if prices in text were tampered
    if (isAnyPriceTampered) {
      return NextResponse.json(
        {
          error: `🚫 Registro de Venta Bloqueado: El precio impreso en el mensaje de WhatsApp difiere de la tarifa oficial de catálogo ($${realTotalUsd.toFixed(2)} USD) para este método de pago y volumen.`,
          isPriceTampered: true,
          realTotalUsd,
        },
        { status: 400 }
      );
    }

    const customerName = cust.customer_name?.trim() || "Cliente";
    const customerLastname = cust.customer_lastname?.trim() || "WhatsApp";
    const docType = (cust.doc_type || "V").toUpperCase() as "V" | "P" | "J" | "E";
    const docNumber = cust.doc_number?.trim() || "00000000";
    const customerIdDoc = `${docType}-${docNumber}`;
    const phone = cust.phone?.trim() || "";
    const address = cust.address?.trim() || "Venta de WhatsApp";
    const shippingCompany = cust.shipping_company?.trim() || "MRW";

    const tasa = await getTasa(auth.session.id).catch(() => null);
    const isBcvPayment = paymentTypeToPricingMethod(paymentType) === "bcv";
    const amountVes = isBcvPayment && tasa?.rate
      ? parseFloat((realTotalUsd * tasa.rate).toFixed(2))
      : null;

    const ip = getClientIp(request);

    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Generate Order Number
        const orderNumber = await generateOrderNumber(tx, "ORD");

        // 2. Resolve Customer
        let customerId: string | null = null;
        if (docNumber && docNumber !== "00000000") {
          const existingCust = await tx.customer.findFirst({
            where: { doc_type: docType, doc_number: docNumber },
          });

          if (existingCust) {
            customerId = existingCust.id;
          } else {
            const createdCust = await tx.customer.create({
              data: {
                doc_type: docType,
                doc_number: docNumber,
                name: customerName,
                lastname: customerLastname,
                phone: phone || null,
                address,
              },
            });
            customerId = createdCust.id;
          }
        }

        // 3. Compute totals & verify stock
        const orderItemsData: Array<{
          variant_id: string;
          quantity: number;
          unit_price_usd: number;
          subtotal_usd: number;
          quantity_divisas: number;
          subtotal_divisas_usd: number;
          variant_snapshot: object;
        }> = [];

        for (const item of validItems) {
          const v = item.matchedVariant!;
          const variant = await tx.productVariant.findUnique({
            where: { id: v.id },
            include: { product: { select: { name: true, color: true } } },
          });

          if (!variant) throw new Error(`Variante ${v.id} no encontrada`);

          const availableStock = channel === "online" ? variant.stock_online : variant.stock_store;
          if (availableStock < item.quantity) {
            throw new Error(`Stock insuficiente para ${variant.product.name} talla ${variant.size}: disponible ${availableStock}, solicitado ${item.quantity}`);
          }

          const unitPrice = item.officialUnitPrice;
          const subtotal = item.officialSubtotalUsd;

          orderItemsData.push({
            variant_id: variant.id,
            quantity: item.quantity,
            unit_price_usd: unitPrice,
            subtotal_usd: subtotal,
            quantity_divisas: item.quantity,
            subtotal_divisas_usd: subtotal,
            variant_snapshot: {
              product_name: variant.product.name,
              color: variant.product.color,
              size: variant.size,
              sku: variant.sku,
            },
          });

          // Deduct stock
          const newOnline = channel === "online" ? variant.stock_online - item.quantity : variant.stock_online;
          const newStore = channel === "tienda" ? variant.stock_store - item.quantity : variant.stock_store;
          const newTotal = newOnline + newStore;

          await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              stock_online: newOnline,
              stock_store: newStore,
              stock_total: newTotal,
            },
          });

          // Create inventory movement
          await tx.inventoryMovement.create({
            data: {
              variant_id: variant.id,
              type: "salida_venta",
              channel: channel === "online" ? "online" : "tienda",
              qty_before: availableStock,
              qty_change: -item.quantity,
              qty_after: availableStock - item.quantity,
              reason: `Venta WhatsApp #${orderNumber}`,
              created_by: auth.session.id,
            },
          });
        }

        // 4. Create Order
        const newOrder = await tx.order.create({
          data: {
            order_number: orderNumber,
            channel,
            status: "pendiente_pago",
            customer_id: customerId,
            customer_name: customerName,
            customer_lastname: customerLastname,
            customer_id_doc: customerIdDoc,
            address,
            shipping_company: shippingCompany,
            total_usd: realTotalUsd,
            pricing_method: paymentTypeToPricingMethod(paymentType),
            total_divisas_usd: isBcvPayment ? 0 : realTotalUsd,
            total_bcv_usd: isBcvPayment ? realTotalUsd : 0,
            exchange_rate_id: tasa?.id || null,
            notes: `Venta importada directamente de WhatsApp (Vendedor: ${auth.session.name})`,
            created_by: auth.session.id,
            items: {
              createMany: {
                data: orderItemsData,
              },
            },
            payments: {
              create: {
                payment_type: paymentType,
                amount_usd: realTotalUsd,
                amount_ves: amountVes,
                exchange_rate_id: tasa?.id || null,
                payment_date: new Date(getVenezuelaDateString()),
                reference: `WAP-${Date.now().toString().slice(-6)}`,
                reference_hash: `WAP${Date.now().toString().slice(-6)}`,
                status: "pendiente",
              },
            },
          },
        });

        // 5. Audit Log
        await tx.auditLog.create({
          data: {
            user_id: auth.session.id,
            action: "CREATE",
            entity_type: "Order",
            entity_id: newOrder.id,
            data_after: { order_number: newOrder.order_number, total_usd: realTotalUsd, source: "whatsapp_import" },
            ip_address: ip,
          },
        });

        return newOrder;
      });

      return NextResponse.json({
        orderId: result.id,
        orderNumber: result.order_number,
        message: "¡Orden creada automáticamente con éxito!",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al crear la orden directamente";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  // ACTION 2: CART CREATION (Secondary workflow for editing)
  if (body.action === "create_cart") {
    const validItems = matchedItems.filter((i) => i.matchedVariant);
    if (validItems.length === 0) {
      return NextResponse.json({ error: "Ningún producto seleccionado coincide con la base de datos" }, { status: 400 });
    }

    const cart = await prisma.cart.create({
      data: {
        vendor_id: auth.session.id,
        channel,
        note: `Importado de WhatsApp - Cliente: ${parsed.customer.customer_name} ${parsed.customer.customer_lastname}`.trim(),
        items: {
          createMany: {
            data: validItems.map((i) => ({
              variant_id: i.matchedVariant!.id,
              quantity: i.quantity,
              unit_price_usd: i.officialUnitPrice,
            })),
          },
        },
      },
    });

    return NextResponse.json({
      cartId: cart.id,
      parsedCustomer: parsed.customer,
      items: matchedItems,
      totalUsd: realTotalUsd,
    });
  }

  return NextResponse.json({
    parsedCustomer: parsed.customer,
    items: matchedItems,
    totalUsd: realTotalUsd,
    isAnyPriceTampered,
  });
}
