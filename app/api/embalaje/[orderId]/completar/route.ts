import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";

// POST /api/embalaje/[orderId]/completar — mark order as completada
export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const auth = await withRole(["admin", "inventario", "embalador"]);
  if (!auth.ok) return auth.response;

  const { orderId } = params;
  const ip = getClientIp(request);

  try {
    await prisma.$transaction(async (tx) => {
      // Validate order exists and has correct status
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order) throw new Error("NOT_FOUND");
      if (order.status !== "enviada") throw new Error("INVALID_STATUS");

      // 1. Update order status to completada
      await tx.order.update({
        where: { id: orderId },
        data: { status: "completada" },
      });

      // 2. Update shipment shipped_at (use updateMany to avoid errors if no shipment)
      await tx.orderShipment.updateMany({
        where: { order_id: orderId },
        data: { shipped_at: new Date() },
      });

      // 3. Audit log
      await tx.auditLog.create({
        data: {
          user_id: auth.session.id,
          action: "completada",
          entity_type: "Order",
          entity_id: orderId,
          data_before: { status: "enviada" },
          data_after: { status: "completada" },
          ip_address: ip,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NOT_FOUND") {
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    }
    if (msg === "INVALID_STATUS") {
      return NextResponse.json({ error: "La orden no está en estado enviada" }, { status: 409 });
    }
    console.error("POST /api/embalaje/[orderId]/completar:", err);
    return NextResponse.json({ error: "Error interno al completar la orden" }, { status: 500 });
  }
}
