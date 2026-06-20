import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";

// POST /api/inventory/adjust
export async function POST(request: NextRequest) {
  const auth = await withRole(["admin", "inventario"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const { variant_id, new_stock_online, new_stock_store, reason } = body;

  if (!variant_id) return NextResponse.json({ error: "variant_id es requerido" }, { status: 400 });
  if (!reason?.trim()) return NextResponse.json({ error: "El motivo es requerido" }, { status: 400 });

  const newOnline = Math.floor(Number(new_stock_online));
  const newStore = Math.floor(Number(new_stock_store));

  if (isNaN(newOnline) || isNaN(newStore))
    return NextResponse.json({ error: "Stock inválido" }, { status: 400 });
  if (newOnline < 0 || newStore < 0)
    return NextResponse.json({ error: "El stock no puede ser negativo" }, { status: 400 });

  const ip = getClientIp(request);
  const newTotal = newOnline + newStore;

  try {
    await prisma.$transaction(async (tx) => {
      // Read inside transaction so qty_before reflects the committed state at lock time
      const variant = await tx.productVariant.findUnique({ where: { id: variant_id } });
      if (!variant) throw new Error("NOT_FOUND");

      await tx.productVariant.update({
        where: { id: variant_id },
        data: { stock_online: newOnline, stock_store: newStore, stock_total: newTotal },
      });

      // Create one movement per channel that changed
      if (newOnline !== variant.stock_online) {
        await tx.inventoryMovement.create({
          data: {
            variant_id,
            type: "ajuste",
            channel: "online",
            qty_before: variant.stock_online,
            qty_change: newOnline - variant.stock_online,
            qty_after: newOnline,
            reason: reason.trim(),
            created_by: auth.session.id,
          },
        });
      }

      if (newStore !== variant.stock_store) {
        await tx.inventoryMovement.create({
          data: {
            variant_id,
            type: "ajuste",
            channel: "tienda",
            qty_before: variant.stock_store,
            qty_change: newStore - variant.stock_store,
            qty_after: newStore,
            reason: reason.trim(),
            created_by: auth.session.id,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          user_id: auth.session.id,
          action: "STOCK_ADJUST",
          entity_type: "ProductVariant",
          entity_id: variant_id,
          data_before: {
            stock_online: variant.stock_online,
            stock_store: variant.stock_store,
            stock_total: variant.stock_total,
          },
          data_after: { stock_online: newOnline, stock_store: newStore, stock_total: newTotal },
          ip_address: ip,
        },
      });
    });

    return NextResponse.json({ success: true, stock_total: newTotal });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NOT_FOUND")
      return NextResponse.json({ error: "Variante no encontrada" }, { status: 404 });
    console.error("POST /api/inventory/adjust:", err);
    return NextResponse.json({ error: "Error al ajustar el stock" }, { status: 500 });
  }
}
