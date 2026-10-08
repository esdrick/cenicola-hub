import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/app/generated/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const motivo = typeof body?.motivo === "string" ? body.motivo.trim() : "";
  if (!motivo) {
    return NextResponse.json({ error: "El motivo es requerido" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: true, payments: true },
  });

  if (!order) return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  if (order.status !== "enviada" && order.status !== "completada") {
    return NextResponse.json(
      { error: "Solo se puede forzar la devolución de órdenes enviadas o completadas" },
      { status: 422 }
    );
  }

  const ip = getClientIp(request);

  await prisma.$transaction(async (tx) => {
    // Bloqueo pesimista determinista ordenado por variant_id para restaurar inventario con consistencia total
    const variantIds = Array.from(new Set(order.items.map((i) => i.variant_id))).sort();
    if (variantIds.length > 0) {
      await tx.$queryRaw`
        SELECT id FROM product_variants
        WHERE id IN (${Prisma.join(variantIds)})
        ORDER BY id ASC
        FOR UPDATE
      `;
    }

    for (const item of order.items) {
      const variant = await tx.productVariant.findUnique({ where: { id: item.variant_id } });
      if (!variant) continue;

      const newOnline = order.channel === "online" ? variant.stock_online + item.quantity : variant.stock_online;
      const newStore  = order.channel === "tienda" ? variant.stock_store + item.quantity : variant.stock_store;
      const newTotal  = newOnline + newStore;

      await tx.productVariant.update({
        where: { id: item.variant_id },
        data: { stock_online: newOnline, stock_store: newStore, stock_total: newTotal },
      });

      const movChannel = order.channel === "online" ? "online" : "tienda";
      const qtyBefore = order.channel === "online" ? variant.stock_online : variant.stock_store;
      await tx.inventoryMovement.create({
        data: {
          variant_id: item.variant_id,
          type: "devolucion",
          channel: movChannel,
          qty_before: qtyBefore,
          qty_change: item.quantity,
          qty_after: qtyBefore + item.quantity,
          reason: `Devolución forzada orden ${order.order_number}: ${motivo}`,
          order_id: order.id,
          created_by: auth.session.id,
        },
      });
    }

    await tx.orderPayment.updateMany({
      where: { order_id: order.id, status: { not: "rechazado" } },
      data: { status: "rechazado", rejection_reason: motivo },
    });

    await tx.order.update({ where: { id: order.id }, data: { status: "cancelada" } });

    await tx.auditLog.create({
      data: {
        user_id: auth.session.id,
        action: "FORCE_CANCEL",
        entity_type: "Order",
        entity_id: order.id,
        data_before: { status: order.status, items: order.items, payments: order.payments },
        data_after: { status: "cancelada", motivo },
        ip_address: ip,
      },
    });
  });

  return NextResponse.json({ ok: true });
}
