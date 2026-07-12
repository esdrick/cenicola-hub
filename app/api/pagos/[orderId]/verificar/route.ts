import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const auth = await withRole(["admin", "inventario"]);
  if (!auth.ok) return auth.response;

  const ip = getClientIp(request);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: params.orderId },
        include: {
          payments: { where: { status: { not: "rechazado" } } },
        },
      });

      if (!order) throw new Error("NOT_FOUND");
      if (!["pendiente_pago", "pago_parcial"].includes(order.status)) {
        throw new Error("INVALID_STATUS");
      }

      const totalUsd = Number(order.total_usd);
      const paidUsd = parseFloat(
        order.payments.reduce((s, p) => s + Number(p.amount_usd), 0).toFixed(2)
      );
      const isFullyPaid = paidUsd >= totalUsd - 0.01;

      if (!isFullyPaid && !order.is_partial_agreed) {
        throw new Error("PARTIAL_NOT_AGREED");
      }

      const prevStatus = order.status;

      // Transition to pago_verificado
      await tx.order.update({
        where: { id: order.id },
        data: { status: "pago_verificado", pago_verificado_at: new Date() },
      });

      await tx.auditLog.create({
        data: {
          user_id: auth.session.id,
          action: "pago_verificado",
          entity_type: "Order",
          entity_id: order.id,
          data_before: { status: prevStatus, total_usd: totalUsd },
          data_after: { status: "pago_verificado", paid_usd: paidUsd },
          ip_address: ip,
        },
      });

      // Tienda completes immediately; online moves straight to embalaje — this is
      // the manual verification step, so no separate "confirmar" click is needed.
      const finalStatus = order.channel === "tienda" ? "completada" : "en_embalaje";
      await tx.order.update({
        where: { id: order.id },
        data: { status: finalStatus },
      });
      await tx.auditLog.create({
        data: {
          user_id: auth.session.id,
          action: "estado_actualizado",
          entity_type: "Order",
          entity_id: order.id,
          data_before: { status: "pago_verificado" },
          data_after: { status: finalStatus },
          ip_address: ip,
        },
      });

      // Mark all pending payments as verified
      await tx.orderPayment.updateMany({
        where: { order_id: order.id, status: "pendiente" },
        data: {
          status: "verificado",
          verified_by: auth.session.id,
          verified_at: new Date(),
        },
      });

      // Sync AccountReceivable with verified payment state
      const existing = await tx.accountReceivable.findFirst({
        where: { order_id: order.id },
      });

      if (isFullyPaid) {
        // Close any open receivable — debt is settled
        if (existing && existing.status !== "cobrado") {
          await tx.accountReceivable.update({
            where: { id: existing.id },
            data: { amount_paid_usd: existing.amount_usd, status: "cobrado" },
          });
        }
      } else {
        const debtUsd = parseFloat((totalUsd - paidUsd).toFixed(2));
        if (existing) {
          await tx.accountReceivable.update({
            where: { id: existing.id },
            data: { amount_usd: debtUsd, status: "pendiente" },
          });
        } else {
          await tx.accountReceivable.create({
            data: {
              description: `Saldo pendiente - Orden ${order.order_number}`,
              debtor_name: `${order.customer_name} ${order.customer_lastname}`,
              amount_usd: debtUsd,
              amount_paid_usd: 0,
              due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              status: "pendiente",
              order_id: order.id,
              created_by: auth.session.id,
            },
          });
        }
      }

      return { finalStatus };
    });

    return NextResponse.json({ success: true, status: result.finalStatus });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NOT_FOUND")
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    if (msg === "INVALID_STATUS")
      return NextResponse.json(
        { error: "La orden no está en estado de verificación de pago" },
        { status: 409 }
      );
    if (msg === "PARTIAL_NOT_AGREED")
      return NextResponse.json(
        {
          error:
            "Pago incompleto. Solo se puede verificar si el monto cubre el total o si el pago parcial fue acordado previamente.",
        },
        { status: 403 }
      );
    console.error("POST /api/pagos/[orderId]/verificar:", err);
    return NextResponse.json({ error: "Error interno al verificar el pago" }, { status: 500 });
  }
}
