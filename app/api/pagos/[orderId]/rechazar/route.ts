import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const auth = await withRole(["admin", "inventario"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const motivo = (body.motivo ?? "").toString().trim();
  if (!motivo) return NextResponse.json({ error: "El motivo de rechazo es requerido" }, { status: 400 });

  const ip = getClientIp(request);

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: params.orderId },
        include: { payments: { where: { status: "pendiente" } } },
      });

      if (!order) throw new Error("NOT_FOUND");
      if (!["pendiente_pago", "pago_parcial"].includes(order.status)) {
        throw new Error("INVALID_STATUS");
      }

      const prevStatus = order.status;

      // Reject all pending payments first
      await tx.orderPayment.updateMany({
        where: { order_id: order.id, status: "pendiente" },
        data: { status: "rechazado", rejection_reason: motivo },
      });

      // El estado post-rechazo depende de si aún queda algún otro pago activo (p.ej. un
      // efectivo ya verificado que coexistía con el pago rechazado) — nunca asumir
      // "pendiente_pago" a ciegas, o se pierde el estado "pago_parcial" real.
      const remainingActive = await tx.orderPayment.count({
        where: { order_id: order.id, status: { not: "rechazado" } },
      });
      const newStatus = remainingActive > 0 ? "pago_parcial" : "pendiente_pago";

      await tx.order.update({
        where: { id: order.id },
        data: { status: newStatus },
      });

      await tx.auditLog.create({
        data: {
          user_id: auth.session.id,
          action: "pago_rechazado",
          entity_type: "Order",
          entity_id: order.id,
          data_before: { status: prevStatus },
          data_after: { status: newStatus, motivo },
          ip_address: ip,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NOT_FOUND")
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    if (msg === "INVALID_STATUS")
      return NextResponse.json(
        { error: "La orden no está en estado de verificación de pago" },
        { status: 409 }
      );
    console.error("POST /api/pagos/[orderId]/rechazar:", err);
    return NextResponse.json({ error: "Error interno al rechazar el pago" }, { status: 500 });
  }
}
