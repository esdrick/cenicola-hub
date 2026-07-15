import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getClientIp } from "@/lib/api-auth";
import { generateOrderNumber, normalizeReference } from "@/lib/order-utils";
import { getTasa } from "@/lib/tasa-cambio";
import { resolveSplitSubtotal, paymentTypeToPricingMethod } from "@/lib/pricing";
import { getSetting } from "@/lib/settings";
import type { PaymentType } from "@/app/generated/prisma/client";

type Params = { params: Promise<{ id: string }> };

// POST /api/carts/[id]/convert — convert pre-order cart to a real order
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const cart = await prisma.cart.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!cart) return NextResponse.json({ error: "Carrito no encontrado" }, { status: 404 });

  const isVendor =
    auth.session.role === "vendedora_online" || auth.session.role === "vendedora_tienda";
  if (isVendor && cart.vendor_id !== auth.session.id) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  if (cart.status !== "active") {
    return NextResponse.json({ error: "Este carrito ya está siendo procesado" }, { status: 409 });
  }

  if (cart.items.length === 0) {
    return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const {
    customer_name, customer_lastname,
    doc_type, doc_number, customer_address, customer_phone,
    address, shipping_company, notes,
    payments, is_partial_agreed,
  } = body;

  const channel = cart.channel;
  const DOC_TYPES = ["V", "P", "J", "E"] as const;
  const PHONE_RE = /^0\d{9,10}$/;
  const hasDoc = doc_type && doc_number?.trim();
  const customer_id_doc = hasDoc ? `${doc_type}-${doc_number.trim()}` : "";

  if (channel === "online") {
    if (!customer_name?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    if (!customer_lastname?.trim()) return NextResponse.json({ error: "Apellido requerido" }, { status: 400 });
    if (!hasDoc) return NextResponse.json({ error: "Documento de identidad requerido" }, { status: 400 });
    if (!DOC_TYPES.includes(doc_type)) return NextResponse.json({ error: "Tipo de documento inválido" }, { status: 400 });
    if (!address?.trim()) return NextResponse.json({ error: "Dirección requerida para canal online" }, { status: 400 });
    if (!shipping_company?.trim()) return NextResponse.json({ error: "Empresa de envío requerida para canal online" }, { status: 400 });
    if (!customer_phone?.trim()) return NextResponse.json({ error: "Teléfono requerido para canal online" }, { status: 400 });
  }
  if (customer_phone?.trim() && !PHONE_RE.test(customer_phone.trim())) {
    return NextResponse.json({ error: "Número de teléfono inválido" }, { status: 400 });
  }
  if (!Array.isArray(payments) || payments.length === 0) return NextResponse.json({ error: "Agrega al menos un pago" }, { status: 400 });

  const canPartial = ["admin", "inventario", "vendedora_online", "vendedora_tienda"].includes(
    auth.session.role
  );
  const outerPartialAgreed = is_partial_agreed === true && canPartial;
  const ip = getClientIp(request);

  const tasaResult = await getTasa(auth.session.id).catch(() => null);
  const tasaId = tasaResult?.id ?? null;

  // Total quantity across the whole cart determines the price tier (paquete/mayor)
  // for every line — recomputed here rather than trusting each CartItem's stored
  // unit_price_usd, as a defense-in-depth against any staleness.
  const totalQty = cart.items.reduce((s, i) => s + i.quantity, 0);
  const [mayorThreshold, bundleThreshold] = await Promise.all([
    getSetting("mayor_threshold"),
    getSetting("bundle_threshold"),
  ]);

  // Mark cart as converting to prevent concurrent conversions
  await prisma.cart.update({ where: { id }, data: { status: "converting" } });

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Build order items from cart items
      const orderItems: Array<{
        variant_id: string; quantity: number; unit_price_usd: number;
        subtotal_usd: number; quantity_bcv: number; quantity_divisas: number;
        subtotal_bcv_usd: number; subtotal_divisas_usd: number; variant_snapshot: object;
      }> = [];
      let totalUsd = 0;
      let totalBcvUsd = 0;
      let totalDivisasUsd = 0;

      for (const item of cart.items) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variant_id },
          include: { product: { select: { name: true, color: true } } },
        });
        if (!variant) throw new Error(`Variante ${item.variant_id} no encontrada`);
        if (!variant.is_active) throw new Error(`Variante ${variant.size} inactiva`);

        const qty = item.quantity;
        const availableStock = channel === "online" ? variant.stock_online : variant.stock_store;
        if (availableStock < qty) {
          throw new Error(
            `Stock insuficiente para ${variant.product.name} talla ${variant.size}: disponible ${availableStock}, solicitado ${qty}`
          );
        }

        // Defense-in-depth against stale CartItem prices/split, same as before — recompute
        // fresh from the variant instead of trusting stored subtotal_*_usd.
        const { subtotalBcv, subtotalDivisas } = resolveSplitSubtotal(
          variant, item.quantity_bcv, item.quantity_divisas, totalQty, mayorThreshold, bundleThreshold,
        );
        const subtotal = parseFloat((subtotalBcv + subtotalDivisas).toFixed(2));
        const unitPrice = qty > 0 ? parseFloat((subtotal / qty).toFixed(2)) : 0;
        totalUsd += subtotal;
        totalBcvUsd += subtotalBcv;
        totalDivisasUsd += subtotalDivisas;

        orderItems.push({
          variant_id: variant.id,
          quantity: qty,
          unit_price_usd: unitPrice,
          subtotal_usd: subtotal,
          quantity_bcv: item.quantity_bcv,
          quantity_divisas: item.quantity_divisas,
          subtotal_bcv_usd: subtotalBcv,
          subtotal_divisas_usd: subtotalDivisas,
          variant_snapshot: {
            product_name: variant.product.name,
            color: variant.product.color,
            size: variant.size,
            sku: variant.sku,
            price_bcv: unitPrice,
          },
        });
      }
      totalBcvUsd = parseFloat(totalBcvUsd.toFixed(2));
      totalDivisasUsd = parseFloat(totalDivisasUsd.toFixed(2));
      totalUsd = parseFloat(totalUsd.toFixed(2));

      const isSplitOrder = totalBcvUsd > 0 && totalDivisasUsd > 0;

      // A pedido dividido entre las dos monedas nunca se le permite quedar en pago parcial —
      // cada moneda debe cubrirse con sus propios pagos antes de cerrar la orden.
      const partialAgreed = outerPartialAgreed && !isSplitOrder;

      // 1b. Aggregate check: payments need to add up to the order's total, $1 rounding margin.
      // (Per-currency floor/cap below is what actually enforces paying each bucket in its own
      // currency — this alone would still allow shifting money between currencies.)
      const plannedTotal = payments.reduce((s: number, p: { amount_usd: number }) => s + (Number(p.amount_usd) || 0), 0);
      if (plannedTotal > totalUsd + 1.00) throw new Error("OVERPAYMENT");

      // Per-currency cap AND floor: no single currency's payments can overshoot what that
      // currency's own portion of the split needs (+ $1 rounding margin), and — once these
      // payments fully cover the order — each currency must also come close to ITS OWN total,
      // not just be "present". Without the floor, someone could pay near the BCV ceiling and
      // barely anything in Divisas (or vice versa) while the aggregate still adds up, silently
      // shifting real money from one currency to the other.
      if (isSplitOrder) {
        const plannedBcv = payments
          .filter((p: { payment_type: PaymentType }) => paymentTypeToPricingMethod(p.payment_type) === "bcv")
          .reduce((s: number, p: { amount_usd: number }) => s + (Number(p.amount_usd) || 0), 0);
        const plannedDivisas = payments
          .filter((p: { payment_type: PaymentType }) => paymentTypeToPricingMethod(p.payment_type) === "divisas")
          .reduce((s: number, p: { amount_usd: number }) => s + (Number(p.amount_usd) || 0), 0);
        if (plannedBcv > totalBcvUsd + 1.00) throw new Error("BUCKET_OVERPAYMENT:bcv");
        if (plannedDivisas > totalDivisasUsd + 1.00) throw new Error("BUCKET_OVERPAYMENT:divisas");

        // Only enforced when these payments fully cover the order — an intentionally underpaid
        // split order (rare: it can't be marked partial-agreed, but nothing stops someone from
        // submitting less) can still be topped up later via agregar-pago, same check there.
        if (plannedTotal >= totalUsd - 0.005) {
          if (plannedBcv < totalBcvUsd - 1.00) throw new Error("SPLIT_CURRENCY_MISMATCH:bcv");
          if (plannedDivisas < totalDivisasUsd - 1.00) throw new Error("SPLIT_CURRENCY_MISMATCH:divisas");
        }
      }

      // 2. Validate reference hashes
      const seenHashes = new Set<string>();
      for (const pay of payments) {
        const payIsCash = (pay.payment_type as PaymentType) === "efectivo_bs" || (pay.payment_type as PaymentType) === "efectivo_usd";
        if (!payIsCash) {
          const hash = normalizeReference(pay.reference ?? "");
          if (!hash) throw new Error("La referencia del pago es requerida");
          if (hash.length < 6 || hash.length > 30) {
            throw new Error("La referencia debe tener entre 6 y 30 caracteres");
          }

          const intraKey = `${pay.payment_type}:${hash}`;
          if (seenHashes.has(intraKey)) throw new Error(`REF_DUP_INTRA:${pay.reference}`);
          seenHashes.add(intraKey);

          const dup = await tx.orderPayment.findFirst({
            where: {
              reference_hash: hash,
              payment_type: pay.payment_type,
              status: { not: "rechazado" },
            },
            include: { order: { select: { order_number: true } } },
          });
          if (dup) throw new Error(`REF_DUP:${dup.order.order_number}`);
        }
      }

      // 3. Determine status
      const allCash = payments.every(
        (p: { payment_type: string }) => p.payment_type === "efectivo_bs" || p.payment_type === "efectivo_usd"
      );
      const totalPaidAmt = parseFloat(
        payments.reduce((s: number, p: { amount_usd: number }) => s + Number(p.amount_usd), 0).toFixed(2)
      );
      const isFullPayment = totalPaidAmt >= totalUsd - 0.005;
      const isCompletada = channel === "tienda" && allCash && isFullPayment;
      // Online + all cash + fully paid → pago_verificado (payment is auto-verified but order still needs shipping)
      const isAutoVerifiedOnline = channel === "online" && allCash && isFullPayment;
      const orderStatus = isCompletada
        ? "completada"
        : isAutoVerifiedOnline
        ? "pago_verificado"
        : partialAgreed
        ? "pago_parcial"
        : "pendiente_pago";

      // 4. Upsert customer if doc provided (address is NOT updated — only admin can change it;
      // phone is synced on every order since it's editable in the checkout form even for known customers)
      let customerId: string | null = null;
      if (hasDoc && DOC_TYPES.includes(doc_type)) {
        const savedCustomer = await tx.customer.upsert({
          where: { doc_type_doc_number: { doc_type, doc_number: doc_number.trim() } },
          update: {
            ...(customer_name?.trim() && { name: customer_name.trim() }),
            ...(customer_lastname?.trim() && { lastname: customer_lastname.trim() }),
            ...(customer_phone?.trim() && { phone: customer_phone.trim() }),
          },
          create: {
            doc_type,
            doc_number: doc_number.trim(),
            name: customer_name?.trim() || "",
            lastname: customer_lastname?.trim() || "",
            address: customer_address?.trim() || null,
            phone: customer_phone?.trim() || null,
          },
        });
        customerId = savedCustomer.id;
      }

      // 5. Create order
      const orderNumber = await generateOrderNumber(tx);
      // Anonymous tienda sales get a placeholder name instead of a blank field,
      // so order lists/receipts elsewhere in the system don't show empty customer data.
      const finalCustomerName =
        customer_name?.trim() || (channel === "tienda" ? "Cliente de tienda" : "");
      const order = await tx.order.create({
        data: {
          order_number: orderNumber,
          channel,
          status: orderStatus,
          customer_id: customerId,
          customer_name: finalCustomerName,
          customer_lastname: customer_lastname?.trim() || "",
          customer_id_doc,
          address: channel === "online" ? address?.trim() : null,
          shipping_company: channel === "online" ? shipping_company?.trim() : null,
          total_usd: totalUsd,
          pricing_method: cart.pricing_method,
          total_bcv_usd: totalBcvUsd,
          total_divisas_usd: totalDivisasUsd,
          exchange_rate_id: tasaId,
          is_partial_agreed: partialAgreed,
          partial_agreed_by: partialAgreed ? auth.session.id : null,
          notes: notes?.trim() || null,
          created_by: auth.session.id,
        },
      });

      // 6. Create items + deduct stock + movements
      for (const item of orderItems) {
        await tx.orderItem.create({
          data: {
            order_id: order.id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            unit_price_usd: item.unit_price_usd,
            subtotal_usd: item.subtotal_usd,
            quantity_bcv: item.quantity_bcv,
            quantity_divisas: item.quantity_divisas,
            subtotal_bcv_usd: item.subtotal_bcv_usd,
            subtotal_divisas_usd: item.subtotal_divisas_usd,
            variant_snapshot: item.variant_snapshot,
          },
        });

        const variant = await tx.productVariant.findUnique({ where: { id: item.variant_id } });
        if (!variant) throw new Error("Variante no encontrada");

        const newOnline = channel === "online" ? variant.stock_online - item.quantity : variant.stock_online;
        const newStore  = channel === "tienda" ? variant.stock_store - item.quantity : variant.stock_store;

        await tx.productVariant.update({
          where: { id: item.variant_id },
          data: { stock_online: newOnline, stock_store: newStore, stock_total: newOnline + newStore },
        });

        const qtyBefore = channel === "online" ? variant.stock_online : variant.stock_store;
        await tx.inventoryMovement.create({
          data: {
            variant_id: item.variant_id,
            type: "salida_venta",
            channel: channel === "online" ? "online" : "tienda",
            qty_before: qtyBefore,
            qty_change: -item.quantity,
            qty_after: qtyBefore - item.quantity,
            reason: `Venta orden ${orderNumber} (desde carrito)`,
            order_id: order.id,
            created_by: auth.session.id,
          },
        });
      }

      // 6. Create payments
      const today = new Date().toISOString().slice(0, 10);
      const tasaRate = tasaResult?.rate ?? null;
      for (const pay of payments) {
        const isEfectivo = (pay.payment_type as PaymentType) === "efectivo_bs" || (pay.payment_type as PaymentType) === "efectivo_usd";
        const hash = isEfectivo ? null : normalizeReference(pay.reference ?? "");
        const amtUsd = parseFloat(Number(pay.amount_usd).toFixed(2));
        const amountVes = tasaId && tasaRate ? parseFloat((amtUsd * tasaRate).toFixed(2)) : null;
        await tx.orderPayment.create({
          data: {
            order_id: order.id,
            payment_type: pay.payment_type,
            amount_usd: amtUsd,
            amount_ves: amountVes,
            exchange_rate_id: tasaId,
            is_partial: pay.is_partial === true,
            payment_date: new Date(pay.payment_date || today),
            payment_time: pay.payment_time || null,
            reference: isEfectivo ? "EFECTIVO" : (pay.reference?.trim() ?? ""),
            reference_hash: hash,
            payment_photo: pay.payment_photo?.trim() || null,
            status: isEfectivo || isCompletada ? "verificado" : "pendiente",
          },
        });
      }

      // 7. If partial payment agreed, create AccountReceivable for the remaining debt
      if (partialAgreed) {
        const totalPaid = parseFloat(
          payments.reduce((s: number, p: { amount_usd: number }) => s + Number(p.amount_usd), 0).toFixed(2)
        );
        const remainingDebt = parseFloat((totalUsd - totalPaid).toFixed(2));
        if (remainingDebt > 0) {
          await tx.accountReceivable.create({
            data: {
              description: `Saldo pendiente - Orden ${orderNumber}`,
              debtor_name: `${customer_name?.trim() || ""} ${customer_lastname?.trim() || ""}`.trim(),
              amount_usd: remainingDebt,
              amount_paid_usd: 0,
              due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              status: "pendiente",
              order_id: order.id,
              created_by: auth.session.id,
            },
          });
        }
      }

      // 8. Delete the cart (cascade deletes cart_items)
      await tx.cart.delete({ where: { id } });

      // 9. Audit log
      await tx.auditLog.create({
        data: {
          user_id: auth.session.id,
          action: "CREATE",
          entity_type: "Order",
          entity_id: order.id,
          data_after: {
            order_number: orderNumber,
            channel,
            status: orderStatus,
            total_usd: totalUsd,
            from_cart: id,
          },
          ip_address: ip,
        },
      });

      return order;
    });

    return NextResponse.json({ id: result.id, order_number: result.order_number }, { status: 201 });
  } catch (err) {
    // Revert cart to active on failure
    await prisma.cart.update({ where: { id }, data: { status: "active" } }).catch(() => null);

    const msg = err instanceof Error ? err.message : "Error al crear la orden";
    if (msg.startsWith("La referencia")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (msg === "OVERPAYMENT") {
      return NextResponse.json(
        { error: "El monto pagado excede el total de la orden. Solo se permite hasta $1.00 de diferencia por redondeo." },
        { status: 422 }
      );
    }
    if (msg.startsWith("SPLIT_CURRENCY_MISMATCH:")) {
      const method = msg.replace("SPLIT_CURRENCY_MISMATCH:", "") as "bcv" | "divisas";
      return NextResponse.json(
        { error: `Este pedido está dividido entre BCV y Divisas — falta cubrir la parte de ${method === "bcv" ? "BCV" : "Divisas"} con pagos de esa moneda (no se puede compensar con la otra).` },
        { status: 422 }
      );
    }
    if (msg.startsWith("BUCKET_OVERPAYMENT:")) {
      const method = msg.replace("BUCKET_OVERPAYMENT:", "") as "bcv" | "divisas";
      return NextResponse.json(
        { error: `El monto en ${method === "bcv" ? "BCV" : "Divisas"} excede lo que corresponde a esa moneda en este pedido (con margen de redondeo de $1).` },
        { status: 422 }
      );
    }
    if (msg.startsWith("REF_DUP_INTRA:")) {
      const ref = msg.replace("REF_DUP_INTRA:", "");
      return NextResponse.json({ error: `Referencia duplicada en esta orden: "${ref}"` }, { status: 409 });
    }
    if (msg.startsWith("REF_DUP:")) {
      const orderNum = msg.replace("REF_DUP:", "");
      return NextResponse.json(
        { error: `Referencia duplicada: ya fue usada en la orden ${orderNum}`, duplicateOrder: orderNum },
        { status: 409 }
      );
    }
    if (msg.includes("Stock insuficiente") || msg.includes("inactiva") || msg.includes("no encontrada")) {
      return NextResponse.json({ error: msg }, { status: 422 });
    }
    console.error("POST /api/carts/[id]/convert:", err);
    return NextResponse.json({ error: "Error interno al crear la orden" }, { status: 500 });
  }
}
