import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string; paymentId: string } }
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
      const payment = await tx.orderPayment.findUnique({
        where: { id: params.paymentId },
        include: { order: { select: { id: true, status: true, order_number: true } } },
      });

      if (!payment || payment.order_id !== params.orderId) throw new Error("NOT_FOUND");
      if (payment.status !== "pendiente") throw new Error("INVALID_PAYMENT_STATUS");
      if (!["pendiente_pago", "pago_parcial"].includes(payment.order.status)) {
        throw new Error("INVALID_ORDER_STATUS");
      }

      const prevOrderStatus = payment.order.status;

      await tx.orderPayment.update({
        where: { id: params.paymentId },
        data: { status: "rechazado", rejection_reason: motivo },
      });

      // Ensure order is at pendiente_pago so vendedora can add a new payment
      if (prevOrderStatus !== "pendiente_pago") {
        await tx.order.update({
          where: { id: params.orderId },
          data: { status: "pendiente_pago" },
        });
      }

      await tx.auditLog.create({
        data: {
          user_id: auth.session.id,
          action: "pago_individual_rechazado",
          entity_type: "Order",
          entity_id: params.orderId,
          data_before: { payment_status: "pendiente", order_status: prevOrderStatus },
          data_after: { payment_id: params.paymentId, payment_status: "rechazado", motivo },
          ip_address: ip,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NOT_FOUND")
      return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
    if (msg === "INVALID_PAYMENT_STATUS")
      return NextResponse.json({ error: "Este pago ya fue procesado" }, { status: 409 });
    if (msg === "INVALID_ORDER_STATUS")
      return NextResponse.json({ error: "La orden no está en estado de verificación" }, { status: 409 });
    console.error("POST /api/pagos/[orderId]/pago/[paymentId]/rechazar:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
