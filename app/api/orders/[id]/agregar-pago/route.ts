import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getClientIp } from "@/lib/api-auth";
import { normalizeReference } from "@/lib/order-utils";
import type { PaymentType } from "@/app/generated/prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const { payment_type, amount_usd, payment_date, payment_time, reference, payment_photo } = body;

  if (!payment_type) return NextResponse.json({ error: "Tipo de pago requerido" }, { status: 400 });
  const amt = parseFloat(amount_usd);
  if (isNaN(amt) || amt <= 0) return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  if (!payment_date) return NextResponse.json({ error: "Fecha de pago requerida" }, { status: 400 });

  const isEfectivo = (payment_type as PaymentType) === "efectivo";
  if (!isEfectivo && !reference?.trim()) {
    return NextResponse.json({ error: "Referencia requerida para este método de pago" }, { status: 400 });
  }

  const ip = getClientIp(request);

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: params.id },
      });

      if (!order) throw new Error("NOT_FOUND");

      // Vendedoras can only add payments to their own orders
      const isRestricted = auth.session.role === "vendedora_online" || auth.session.role === "vendedora_tienda";
      if (isRestricted && order.created_by !== auth.session.id) throw new Error("FORBIDDEN");

      if (!["pendiente_pago", "pago_parcial"].includes(order.status)) {
        throw new Error("INVALID_STATUS");
      }

      // Validate new payment doesn't exceed remaining balance
      const activePayments = await tx.orderPayment.findMany({
        where: { order_id: order.id, status: { not: "rechazado" } },
        select: { amount_usd: true },
      });
      const currentPaid = activePayments.reduce((s, p) => s + Number(p.amount_usd), 0);
      const orderTotal = Number(order.total_usd);
      if (amt > orderTotal - currentPaid + 0.005) {
        throw new Error("EXCEEDS_BALANCE");
      }

      const hash = isEfectivo ? null : normalizeReference(reference ?? "");

      if (hash) {
        // Check duplicate within same order (active payments only)
        const sameDup = await tx.orderPayment.findFirst({
          where: {
            order_id: order.id,
            reference_hash: hash,
            payment_type: payment_type as PaymentType,
            status: { not: "rechazado" },
          },
        });
        if (sameDup) throw new Error("REF_DUP_SAME_ORDER");

        // Check duplicate across other orders
        const crossDup = await tx.orderPayment.findFirst({
          where: {
            reference_hash: hash,
            payment_type: payment_type as PaymentType,
            status: { not: "rechazado" },
            order_id: { not: order.id },
          },
          include: { order: { select: { order_number: true } } },
        });
        if (crossDup) throw new Error(`REF_DUP:${crossDup.order.order_number}`);
      }

      const today = new Date().toISOString().slice(0, 10);
      await tx.orderPayment.create({
        data: {
          order_id: order.id,
          payment_type: payment_type as PaymentType,
          amount_usd: parseFloat(amt.toFixed(2)),
          is_partial: false,
          payment_date: new Date(payment_date || today),
          payment_time: payment_time || null,
          reference: isEfectivo ? "EFECTIVO" : (reference?.trim() ?? ""),
          reference_hash: hash,
          payment_photo: payment_photo?.trim() || null,
          status: "pendiente",
        },
      });

      await tx.auditLog.create({
        data: {
          user_id: auth.session.id,
          action: "pago_agregado",
          entity_type: "Order",
          entity_id: order.id,
          data_before: { status: order.status },
          data_after: {
            payment_type,
            amount_usd: amt,
            reference: isEfectivo ? "EFECTIVO" : reference,
          },
          ip_address: ip,
        },
      });
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (msg === "NOT_FOUND")
      return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
    if (msg === "FORBIDDEN")
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    if (msg === "INVALID_STATUS")
      return NextResponse.json(
        { error: "Solo se pueden agregar pagos a órdenes pendientes de verificación" },
        { status: 409 }
      );
    if (msg === "EXCEEDS_BALANCE")
      return NextResponse.json(
        { error: "El monto supera el saldo pendiente de la orden" },
        { status: 422 }
      );
    if (msg === "REF_DUP_SAME_ORDER")
      return NextResponse.json(
        { error: "Esta referencia ya existe en otro pago de esta orden" },
        { status: 409 }
      );
    if (msg.startsWith("REF_DUP:")) {
      const orderNum = msg.replace("REF_DUP:", "");
      return NextResponse.json(
        { error: `Referencia duplicada: ya fue usada en la orden ${orderNum}`, duplicateOrder: orderNum },
        { status: 409 }
      );
    }
    console.error("POST /api/orders/[id]/agregar-pago:", err);
    return NextResponse.json({ error: "Error interno al agregar el pago" }, { status: 500 });
  }
}
