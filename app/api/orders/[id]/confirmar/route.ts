import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await withRole(["admin", "inventario"]);
  if (!auth.ok) return auth.response;

  const ip = getClientIp(request);

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: params.id } });

      if (!order) throw new Error("NOT_FOUND");
      if (order.channel !== "online") throw new Error("NOT_ONLINE");
      if (order.status !== "pago_verificado") throw new Error("INVALID_STATUS");

      await tx.order.update({
        where: { id: params.id },
        data: { status: "en_embalaje" },
      });

      await tx.auditLog.create({
        data: {
          user_id: auth.session.id,
          action: "estado_actualizado",
          entity_type: "Order",
          entity_id: params.id,
          data_before: { status: "pago_verificado" },
          data_after: { status: "en_embalaje" },
          ip_address: ip,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NOT_FOUND")
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    if (msg === "NOT_ONLINE")
      return NextResponse.json({ error: "Solo aplica para órdenes online" }, { status: 400 });
    if (msg === "INVALID_STATUS")
      return NextResponse.json({ error: "La orden no está en estado pago verificado" }, { status: 409 });
    console.error("POST /api/orders/[id]/confirmar:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
