import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";
import { resolveSplitSubtotal } from "@/lib/pricing";
import { getSetting } from "@/lib/settings";
import type { OrderStatus } from "@/app/generated/prisma/client";

const CLOSED_STATUSES: OrderStatus[] = ["enviada", "completada", "cancelada"];
const REOPEN_STATUSES: OrderStatus[] = ["pago_verificado", "en_embalaje"];

type Line = { variant_id: string; quantity: number };

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await withRole(["admin", "inventario"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const rawItems = body.items;
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return NextResponse.json({ error: "Agrega al menos un producto" }, { status: 400 });
  }

  const lines: Line[] = [];
  const seenVariants = new Set<string>();
  for (const raw of rawItems) {
    const variantId = raw?.variant_id;
    const quantity = Number(raw?.quantity);
    if (typeof variantId !== "string" || !variantId) {
      return NextResponse.json({ error: "Producto inválido en la lista" }, { status: 400 });
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
    }
    if (seenVariants.has(variantId)) {
      return NextResponse.json(
        { error: "Hay un producto duplicado en la lista. Consolida las cantidades antes de enviar." },
        { status: 400 }
      );
    }
    seenVariants.add(variantId);
    lines.push({ variant_id: variantId, quantity });
  }

  const [mayorThreshold, bundleThreshold] = await Promise.all([
    getSetting("mayor_threshold"),
    getSetting("bundle_threshold"),
  ]);

  const ip = getClientIp(request);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: params.id },
        include: { items: { include: { variant: true } } },
      });
      if (!order) throw new Error("NOT_FOUND");
      if (CLOSED_STATUSES.includes(order.status)) throw new Error("INVALID_STATUS");
      if (!order.pricing_method) throw new Error("NO_PRICING_METHOD");
      // This flow prices every line (existing + new) in a single currency — an order that
      // already mixes BCV and Divisas (from the opt-in split at checkout) can't be resolved
      // that way, so block it here rather than guessing which bucket the new lines belong to.
      if (Number(order.total_bcv_usd) > 0 && Number(order.total_divisas_usd) > 0) {
        throw new Error("SPLIT_ORDER");
      }

      const pricingMethod = order.pricing_method;
      const wasReopened = REOPEN_STATUSES.includes(order.status);
      const existingTotalQty = order.items.reduce((s, i) => s + i.quantity, 0);
      const addedQty = lines.reduce((s, l) => s + l.quantity, 0);
      // Quantity used to resolve the price tier (normal/paquete/mayor) for EVERY line in the
      // order, existing and new alike — mirrors how a fresh cart of this final size would be
      // priced, instead of leaving earlier lines stuck at whatever tier they entered at.
      const newTotalQty = existingTotalQty + addedQty;

      const itemsAdded: Array<{ name: string; size: string; quantity: number }> = [];

      for (const line of lines) {
        const variant = await tx.productVariant.findUnique({
          where: { id: line.variant_id },
          include: { product: { select: { name: true, color: true, is_active: true } } },
        });
        if (!variant || !variant.is_active || !variant.product.is_active) {
          throw new Error(`VARIANT_INACTIVE:${line.variant_id}`);
        }

        const availableStock = order.channel === "online" ? variant.stock_online : variant.stock_store;
        if (availableStock < line.quantity) {
          throw new Error(
            `INSUFFICIENT_STOCK:${variant.product.name} talla ${variant.size}: disponible ${availableStock}, solicitado ${line.quantity}`
          );
        }

        const qtyBcv = pricingMethod === "bcv" ? line.quantity : 0;
        const qtyDivisas = pricingMethod === "divisas" ? line.quantity : 0;
        const { subtotalBcv, subtotalDivisas } = resolveSplitSubtotal(
          variant, qtyBcv, qtyDivisas, newTotalQty, mayorThreshold, bundleThreshold,
        );
        const subtotal = parseFloat((subtotalBcv + subtotalDivisas).toFixed(2));
        const unitPrice = line.quantity > 0 ? parseFloat((subtotal / line.quantity).toFixed(2)) : 0;

        await tx.orderItem.create({
          data: {
            order_id: order.id,
            variant_id: variant.id,
            quantity: line.quantity,
            unit_price_usd: unitPrice,
            subtotal_usd: subtotal,
            quantity_bcv: qtyBcv,
            quantity_divisas: qtyDivisas,
            subtotal_bcv_usd: subtotalBcv,
            subtotal_divisas_usd: subtotalDivisas,
            variant_snapshot: {
              product_name: variant.product.name,
              color: variant.product.color,
              size: variant.size,
              sku: variant.sku,
              price_bcv: unitPrice,
            },
          },
        });

        const newOnline = order.channel === "online" ? variant.stock_online - line.quantity : variant.stock_online;
        const newStore  = order.channel === "tienda" ? variant.stock_store - line.quantity : variant.stock_store;

        await tx.productVariant.update({
          where: { id: variant.id },
          data: { stock_online: newOnline, stock_store: newStore, stock_total: newOnline + newStore },
        });

        const qtyBefore = order.channel === "online" ? variant.stock_online : variant.stock_store;
        await tx.inventoryMovement.create({
          data: {
            variant_id: variant.id,
            type: "salida_venta",
            channel: order.channel === "online" ? "online" : "tienda",
            qty_before: qtyBefore,
            qty_change: -line.quantity,
            qty_after: qtyBefore - line.quantity,
            reason: `Producto agregado a orden ${order.order_number}${wasReopened ? " (reapertura)" : ""}`,
            order_id: order.id,
            created_by: auth.session.id,
          },
        });

        itemsAdded.push({ name: variant.product.name, size: variant.size, quantity: line.quantity });
      }

      // Retroactively reprice the lines that already existed, so the whole order settles at
      // the tier its final quantity qualifies for — not just the newly added lines.
      let repricedExisting = false;
      for (const item of order.items) {
        const qtyBcv = pricingMethod === "bcv" ? item.quantity : 0;
        const qtyDivisas = pricingMethod === "divisas" ? item.quantity : 0;
        const { subtotalBcv, subtotalDivisas } = resolveSplitSubtotal(
          item.variant, qtyBcv, qtyDivisas, newTotalQty, mayorThreshold, bundleThreshold,
        );
        const subtotal = parseFloat((subtotalBcv + subtotalDivisas).toFixed(2));
        const unitPrice = item.quantity > 0 ? parseFloat((subtotal / item.quantity).toFixed(2)) : 0;
        if (unitPrice === Number(item.unit_price_usd)) continue;
        repricedExisting = true;
        const snapshot =
          item.variant_snapshot && typeof item.variant_snapshot === "object"
            ? (item.variant_snapshot as Record<string, unknown>)
            : {};
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            unit_price_usd: unitPrice,
            subtotal_usd: subtotal,
            quantity_bcv: qtyBcv,
            quantity_divisas: qtyDivisas,
            subtotal_bcv_usd: subtotalBcv,
            subtotal_divisas_usd: subtotalDivisas,
            variant_snapshot: { ...snapshot, price_bcv: unitPrice },
          },
        });
      }

      const allItems = await tx.orderItem.findMany({
        where: { order_id: order.id },
        select: { subtotal_usd: true, subtotal_bcv_usd: true, subtotal_divisas_usd: true },
      });
      const newTotalUsd = parseFloat(
        allItems.reduce((s, i) => s + Number(i.subtotal_usd), 0).toFixed(2)
      );
      const newTotalBcvUsd = parseFloat(
        allItems.reduce((s, i) => s + Number(i.subtotal_bcv_usd), 0).toFixed(2)
      );
      const newTotalDivisasUsd = parseFloat(
        allItems.reduce((s, i) => s + Number(i.subtotal_divisas_usd), 0).toFixed(2)
      );

      const activePayments = await tx.orderPayment.findMany({
        where: { order_id: order.id, status: { not: "rechazado" } },
        select: { amount_usd: true, status: true },
      });
      const paidTotal = parseFloat(
        activePayments.reduce((s, p) => s + Number(p.amount_usd), 0).toFixed(2)
      );
      // Retroactive repricing can make already-collected payments cover the new total outright
      // (or overshoot it) — treat that exactly like any other "fully paid" transition elsewhere
      // in the app: online settles at pago_verificado (needs the existing "Confirmar" click to
      // reach embalaje, same as a full cash payment), tienda completes immediately. Only VERIFIED
      // money counts here — a still-pending transferencia/zelle awaiting manual verification
      // must not get treated as confirmed just because the totals happen to add up.
      const verifiedPaidTotal = parseFloat(
        activePayments.filter((p) => p.status === "verificado")
          .reduce((s, p) => s + Number(p.amount_usd), 0).toFixed(2)
      );
      const isFullyCovered = verifiedPaidTotal >= newTotalUsd - 0.01;

      const newStatus: OrderStatus = isFullyCovered
        ? (order.channel === "tienda" ? "completada" : "pago_verificado")
        : wasReopened
        ? "pago_parcial"
        : order.status;

      await tx.order.update({
        where: { id: order.id },
        data: {
          total_usd: newTotalUsd,
          total_bcv_usd: newTotalBcvUsd,
          total_divisas_usd: newTotalDivisasUsd,
          status: newStatus,
          ...(isFullyCovered ? { pago_verificado_at: order.pago_verificado_at ?? new Date() } : {}),
          ...(wasReopened ? { is_partial_agreed: false, partial_agreed_by: null } : {}),
        },
      });

      // Sync AccountReceivable with the recalculated balance
      const existingReceivable = await tx.accountReceivable.findFirst({ where: { order_id: order.id } });
      if (isFullyCovered) {
        if (existingReceivable && existingReceivable.status !== "cobrado") {
          await tx.accountReceivable.update({
            where: { id: existingReceivable.id },
            data: { amount_paid_usd: existingReceivable.amount_usd, status: "cobrado" },
          });
        }
      } else {
        const remainingDebt = parseFloat((newTotalUsd - paidTotal).toFixed(2));
        if (remainingDebt > 0) {
          if (existingReceivable) {
            await tx.accountReceivable.update({
              where: { id: existingReceivable.id },
              data: { amount_usd: remainingDebt, status: "pendiente" },
            });
          } else {
            await tx.accountReceivable.create({
              data: {
                description: `Saldo pendiente - Orden ${order.order_number}`,
                debtor_name: `${order.customer_name} ${order.customer_lastname}`,
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
      }

      await tx.auditLog.create({
        data: {
          user_id: auth.session.id,
          action: "producto_agregado",
          entity_type: "Order",
          entity_id: order.id,
          data_before: { status: order.status, total_usd: Number(order.total_usd) },
          data_after: {
            status: newStatus,
            total_usd: newTotalUsd,
            items_added: itemsAdded,
            was_reopened: wasReopened,
            repriced_existing_items: repricedExisting,
          },
          ip_address: ip,
        },
      });

      return { status: newStatus, total_usd: newTotalUsd };
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NOT_FOUND")
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    if (msg === "INVALID_STATUS")
      return NextResponse.json(
        { error: "No se pueden agregar productos a una orden enviada, completada o cancelada" },
        { status: 409 }
      );
    if (msg === "NO_PRICING_METHOD")
      return NextResponse.json(
        { error: "La orden aún no tiene un método de pago establecido. Agrega un pago primero." },
        { status: 409 }
      );
    if (msg === "SPLIT_ORDER")
      return NextResponse.json(
        { error: "Esta orden tiene el pago dividido entre BCV y Divisas — no se pueden agregar productos desde aquí." },
        { status: 409 }
      );
    if (msg.startsWith("VARIANT_INACTIVE:"))
      return NextResponse.json({ error: "Uno de los productos seleccionados ya no está disponible" }, { status: 409 });
    if (msg.startsWith("INSUFFICIENT_STOCK:"))
      return NextResponse.json({ error: `Stock insuficiente para ${msg.slice("INSUFFICIENT_STOCK:".length)}` }, { status: 422 });
    console.error("POST /api/orders/[id]/agregar-productos:", err);
    return NextResponse.json({ error: "Error interno al agregar productos" }, { status: 500 });
  }
}
