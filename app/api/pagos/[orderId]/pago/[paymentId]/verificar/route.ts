import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string; paymentId: string } }
) {
  const auth = await withRole(["admin", "inventario"]);
  if (!auth.ok) return auth.response;

  const ip = getClientIp(request);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.orderPayment.findUnique({
        where: { id: params.paymentId },
        include: { order: true },
      });

      if (!payment || payment.order_id !== params.orderId) throw new Error("NOT_FOUND");
      if (payment.status !== "pendiente") throw new Error("INVALID_PAYMENT_STATUS");
      if (!["pendiente_pago", "pago_parcial"].includes(payment.order.status)) {
        throw new Error("INVALID_ORDER_STATUS");
      }

      const prevOrderStatus = payment.order.status;

      // Mark this specific payment as verified
      await tx.orderPayment.update({
        where: { id: params.paymentId },
        data: { status: "verificado", verified_by: auth.session.id, verified_at: new Date() },
      });

      // Only sum VERIFIED payments — pending ones haven't been approved yet
      // The just-verified payment is already "verificado" within this transaction
      const verifiedPayments = await tx.orderPayment.findMany({
        where: { order_id: params.orderId, status: "verificado" },
      });
      const totalVerified = parseFloat(
        verifiedPayments.reduce((s, p) => s + Number(p.amount_usd), 0).toFixed(2)
      );
      const totalUsd = Number(payment.order.total_usd);
      // Per-payment verify only advances when fully paid.
      // Partial-agreed advances are handled by the global "Verificar todos" action.
      const isFullyPaid = totalVerified >= totalUsd - 0.01;
      const canAdvance = isFullyPaid;

      if (canAdvance) {
        const finalStatus = payment.order.channel === "online" ? "en_embalaje" : "completada";

        await tx.order.update({ where: { id: params.orderId }, data: { status: "pago_verificado" } });
        await tx.auditLog.create({
          data: {
            user_id: auth.session.id,
            action: "pago_verificado",
            entity_type: "Order",
            entity_id: params.orderId,
            data_before: { status: prevOrderStatus },
            data_after: { status: "pago_verificado", payment_id: params.paymentId },
            ip_address: ip,
          },
        });

        await tx.order.update({ where: { id: params.orderId }, data: { status: finalStatus } });
        await tx.auditLog.create({
          data: {
            user_id: auth.session.id,
            action: "estado_actualizado",
            entity_type: "Order",
            entity_id: params.orderId,
            data_before: { status: "pago_verificado" },
            data_after: { status: finalStatus },
            ip_address: ip,
          },
        });


        // Order fully paid — close any open receivable
        const existingReceivable = await tx.accountReceivable.findFirst({
          where: { order_id: params.orderId },
        });
        if (existingReceivable && existingReceivable.status !== "cobrado") {
          await tx.accountReceivable.update({
            where: { id: existingReceivable.id },
            data: { amount_paid_usd: existingReceivable.amount_usd, status: "cobrado" },
          });
        }

        return { advanced: true, finalStatus };
      }

      // Not enough to advance — just log the individual verification
      await tx.auditLog.create({
        data: {
          user_id: auth.session.id,
          action: "pago_individual_verificado",
          entity_type: "Order",
          entity_id: params.orderId,
          data_before: { payment_status: "pendiente" },
          data_after: { payment_id: params.paymentId, total_paid: totalVerified, total_usd: totalUsd },
          ip_address: ip,
        },
      });

      return { advanced: false, finalStatus: prevOrderStatus };
    });

    return NextResponse.json({ success: true, advanced: result.advanced, status: result.finalStatus });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NOT_FOUND")
      return NextResponse.json({ error: "Pago no encontrado" }, { status: 404 });
    if (msg === "INVALID_PAYMENT_STATUS")
      return NextResponse.json({ error: "Este pago ya fue procesado" }, { status: 409 });
    if (msg === "INVALID_ORDER_STATUS")
      return NextResponse.json({ error: "La orden no está en estado de verificación" }, { status: 409 });
    console.error("POST /api/pagos/[orderId]/pago/[paymentId]/verificar:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
