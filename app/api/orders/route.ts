import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, withRole, getClientIp } from "@/lib/api-auth";
import { generateOrderNumber, normalizeReference } from "@/lib/order-utils";
import type { OrderStatus, OrderChannel, PaymentType } from "@/app/generated/prisma/client";

// GET /api/orders
export async function GET(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const q      = sp.get("q")?.trim() ?? "";
  const status = sp.get("status") as OrderStatus | null;
  const channel = sp.get("channel") as OrderChannel | null;
  const sellerId = sp.get("seller") ?? "";
  const desde  = sp.get("desde") ?? "";
  const hasta  = sp.get("hasta") ?? "";
  const page   = Math.max(1, parseInt(sp.get("page") ?? "1"));
  const pageSize = 25;

  const isRestricted = auth.session.role === "vendedora_online" || auth.session.role === "vendedora_tienda";

  const where = {
    // Vendedoras only see their own orders
    ...(isRestricted && { created_by: auth.session.id }),
    // Admin filter by seller
    ...(!isRestricted && sellerId && { created_by: sellerId }),
    ...(status  && { status }),
    ...(channel && { channel }),
    ...(desde && !hasta && { created_at: { gte: new Date(desde) } }),
    ...(hasta && !desde && { created_at: { lte: new Date(`${hasta}T23:59:59`) } }),
    ...(desde && hasta && { created_at: { gte: new Date(desde), lte: new Date(`${hasta}T23:59:59`) } }),
    ...(q && {
      OR: [
        { customer_name: { contains: q, mode: "insensitive" as const } },
        { customer_lastname: { contains: q, mode: "insensitive" as const } },
        { customer_id_doc: { contains: q, mode: "insensitive" as const } },
        { order_number: { contains: q, mode: "insensitive" as const } },
      ],
    }),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { creator: { select: { id: true, name: true } } },
      orderBy: { created_at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  const data = orders.map((o) => ({
    ...o,
    total_usd: Number(o.total_usd),
    created_at: o.created_at.toISOString(),
    updated_at: o.updated_at.toISOString(),
  }));

  return NextResponse.json({ data, total, page, totalPages: Math.ceil(total / pageSize) });
}

// POST /api/orders
export async function POST(request: NextRequest) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const {
    customer_name, customer_lastname, customer_id_doc,
    channel, address, shipping_company, notes,
    items, payments, is_partial_agreed,
  } = body;

  // Basic validation
  if (!customer_name?.trim()) return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
  if (!customer_lastname?.trim()) return NextResponse.json({ error: "Apellido requerido" }, { status: 400 });
  if (!customer_id_doc?.trim()) return NextResponse.json({ error: "Cédula requerida" }, { status: 400 });
  if (!channel) return NextResponse.json({ error: "Canal requerido" }, { status: 400 });
  if (channel === "online" && !address?.trim()) return NextResponse.json({ error: "Dirección requerida para canal online" }, { status: 400 });
  if (channel === "online" && !shipping_company?.trim()) return NextResponse.json({ error: "Empresa de envío requerida para canal online" }, { status: 400 });
  if (!Array.isArray(items) || items.length === 0) return NextResponse.json({ error: "El carrito está vacío" }, { status: 400 });
  if (!Array.isArray(payments) || payments.length === 0) return NextResponse.json({ error: "Agrega al menos un pago" }, { status: 400 });

  // is_partial_agreed only admin can set
  const partialAgreed = is_partial_agreed === true && auth.session.role === "admin";

  const ip = getClientIp(request);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validate stock and build items
      const orderItems: Array<{
        variant_id: string; quantity: number; unit_price_usd: number;
        subtotal_usd: number; variant_snapshot: object;
      }> = [];
      let totalUsd = 0;

      for (const item of items) {
        const variant = await tx.productVariant.findUnique({
          where: { id: item.variant_id },
          include: { product: { select: { name: true, color: true } } },
        });
        if (!variant) throw new Error(`Variante ${item.variant_id} no encontrada`);
        if (!variant.is_active) throw new Error(`Variante ${variant.size} inactiva`);

        const qty = Math.max(1, Math.floor(Number(item.quantity)));
        const availableStock = channel === "online" ? variant.stock_online : variant.stock_store;
        if (availableStock < qty) {
          throw new Error(`Stock insuficiente para ${variant.product.name} talla ${variant.size}: disponible ${availableStock}, solicitado ${qty}`);
        }

        const unitPrice = parseFloat(Number(item.unit_price_usd).toFixed(2));
        const subtotal = parseFloat((unitPrice * qty).toFixed(2));
        totalUsd += subtotal;

        orderItems.push({
          variant_id: variant.id,
          quantity: qty,
          unit_price_usd: unitPrice,
          subtotal_usd: subtotal,
          variant_snapshot: {
            product_name: variant.product.name,
            color: variant.product.color,
            size: variant.size,
            sku: variant.sku,
            price_usd: unitPrice,
          },
        });
      }

      // 2. Validate reference hashes (skip efectivo)
      const seenHashes = new Set<string>();
      for (const pay of payments) {
        if ((pay.payment_type as PaymentType) !== "efectivo") {
          const hash = normalizeReference(pay.reference ?? "");
          if (!hash) throw new Error("La referencia del pago es requerida");

          // Intra-order duplicate (same type + same reference in this batch)
          const intraKey = `${pay.payment_type}:${hash}`;
          if (seenHashes.has(intraKey)) {
            throw new Error(`REF_DUP_INTRA:${pay.reference}`);
          }
          seenHashes.add(intraKey);

          // Cross-order duplicate
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
      const isCash = payments.length === 1 && payments[0].payment_type === "efectivo";
      const isFullPayment = Math.abs(totalUsd - parseFloat(Number(payments[0]?.amount_usd ?? 0).toFixed(2))) < 0.01;
      const isCompletada = channel === "tienda" && isCash && isFullPayment;
      const orderStatus = isCompletada ? "completada" : partialAgreed ? "pago_parcial" : "pendiente_pago";

      // 4. Create order
      const orderNumber = await generateOrderNumber(tx);
      const order = await tx.order.create({
        data: {
          order_number: orderNumber,
          channel,
          status: orderStatus,
          customer_name: customer_name.trim(),
          customer_lastname: customer_lastname.trim(),
          customer_id_doc: customer_id_doc.trim(),
          address: channel === "online" ? address?.trim() : null,
          shipping_company: channel === "online" ? shipping_company?.trim() : null,
          total_usd: totalUsd,
          is_partial_agreed: partialAgreed,
          partial_agreed_by: partialAgreed ? auth.session.id : null,
          notes: notes?.trim() || null,
          created_by: auth.session.id,
        },
      });

      // 5. Create items + deduct stock + movements
      for (const item of orderItems) {
        await tx.orderItem.create({
          data: {
            order_id: order.id,
            variant_id: item.variant_id,
            quantity: item.quantity,
            unit_price_usd: item.unit_price_usd,
            subtotal_usd: item.subtotal_usd,
            variant_snapshot: item.variant_snapshot,
          },
        });

        const variant = await tx.productVariant.findUnique({ where: { id: item.variant_id } });
        if (!variant) throw new Error("Variante no encontrada");

        const newOnline = channel === "online" ? variant.stock_online - item.quantity : variant.stock_online;
        const newStore  = channel === "tienda" ? variant.stock_store - item.quantity : variant.stock_store;
        const newTotal  = newOnline + newStore;

        await tx.productVariant.update({
          where: { id: item.variant_id },
          data: { stock_online: newOnline, stock_store: newStore, stock_total: newTotal },
        });

        const movChannel = channel === "online" ? "online" : "tienda";
        const qtyBefore = channel === "online" ? variant.stock_online : variant.stock_store;
        await tx.inventoryMovement.create({
          data: {
            variant_id: item.variant_id,
            type: "salida_venta",
            channel: movChannel,
            qty_before: qtyBefore,
            qty_change: -item.quantity,
            qty_after: qtyBefore - item.quantity,
            reason: `Venta orden ${orderNumber}`,
            order_id: order.id,
            created_by: auth.session.id,
          },
        });
      }

      // 6. Create payments
      const today = new Date().toISOString().slice(0, 10);
      for (const pay of payments) {
        const isEfectivo = (pay.payment_type as PaymentType) === "efectivo";
        const hash = isEfectivo ? null : normalizeReference(pay.reference ?? "");
        await tx.orderPayment.create({
          data: {
            order_id: order.id,
            payment_type: pay.payment_type,
            amount_usd: parseFloat(Number(pay.amount_usd).toFixed(2)),
            is_partial: pay.is_partial === true,
            payment_date: new Date(pay.payment_date || today),
            payment_time: pay.payment_time || null,
            reference: isEfectivo ? "EFECTIVO" : (pay.reference?.trim() ?? ""),
            reference_hash: hash,
            payment_photo: pay.payment_photo?.trim() || null,
            status: (isEfectivo || isCompletada) ? "verificado" : "pendiente",
          },
        });
      }

      // 7. Audit log
      await tx.auditLog.create({
        data: {
          user_id: auth.session.id,
          action: "CREATE",
          entity_type: "Order",
          entity_id: order.id,
          data_after: { order_number: orderNumber, channel, status: orderStatus, total_usd: totalUsd },
          ip_address: ip,
        },
      });

      return order;
    });

    return NextResponse.json({ id: result.id, order_number: result.order_number }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al crear la orden";
    if (msg.startsWith("REF_DUP_INTRA:")) {
      const ref = msg.replace("REF_DUP_INTRA:", "");
      return NextResponse.json(
        { error: `Referencia duplicada en esta orden: "${ref}" ya fue añadida` },
        { status: 409 }
      );
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
    console.error("POST /api/orders:", err);
    return NextResponse.json({ error: "Error interno al crear la orden" }, { status: 500 });
  }
}
