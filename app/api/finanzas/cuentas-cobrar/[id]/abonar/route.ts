import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole, getClientIp } from "@/lib/api-auth";
import type { PaymentType } from "@/app/generated/prisma/client";

const VALID_PAYMENT_TYPES: PaymentType[] = [
  "efectivo_bs", "efectivo_usd", "transferencia", "zelle", "pago_movil", "usdt",
];

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const { monto, metodo_pago, referencia } = body;

  if (!monto || isNaN(Number(monto)) || Number(monto) <= 0)
    return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  if (!metodo_pago?.trim())
    return NextResponse.json({ error: "Método de pago requerido" }, { status: 400 });
  if (!VALID_PAYMENT_TYPES.includes(metodo_pago as PaymentType))
    return NextResponse.json({ error: "Método de pago inválido" }, { status: 400 });

  const isCash = (metodo_pago as PaymentType) === "efectivo_bs" || (metodo_pago as PaymentType) === "efectivo_usd";
  if (!isCash && !referencia?.trim())
    return NextResponse.json({ error: "Referencia requerida para este método de pago" }, { status: 400 });

  const cuenta = await prisma.accountReceivable.findUnique({
    where: { id: params.id },
    include: { order: { select: { id: true, status: true, channel: true } } },
  });
  if (!cuenta) return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
  if (cuenta.status === "cobrado")
    return NextResponse.json({ error: "Esta cuenta ya está completamente cobrada" }, { status: 409 });

  const abono = parseFloat(Number(monto).toFixed(2));
  const newPaid = parseFloat((Number(cuenta.amount_paid_usd) + abono).toFixed(2));
  const total = Number(cuenta.amount_usd);
  const newPending = Math.max(0, parseFloat((total - newPaid).toFixed(2)));
  const newStatus = newPending <= 0 ? "cobrado" : "cobrado_parcial";

  const ip = getClientIp(request);
  const today = new Date().toISOString().slice(0, 10);

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.accountReceivable.update({
      where: { id: params.id },
      data: { amount_paid_usd: newPaid, status: newStatus },
    });

    // Associate the abono as a verified payment on the linked order
    if (cuenta.order_id) {
      await tx.orderPayment.create({
        data: {
          order_id: cuenta.order_id,
          payment_type: metodo_pago as PaymentType,
          amount_usd: abono,
          is_partial: newPending > 0,
          payment_date: new Date(today),
          reference: isCash ? "EFECTIVO" : referencia.trim(),
          reference_hash: null,
          status: "verificado",
          verified_by: auth.session.id,
          verified_at: new Date(),
        },
      });

      // If the order is still in pago_parcial and the debt is now fully settled, advance it
      if (cuenta.order && cuenta.order.status === "pago_parcial" && newPending <= 0) {
        const finalStatus = cuenta.order.channel === "online" ? "en_embalaje" : "completada";
        await tx.order.update({
          where: { id: cuenta.order_id },
          data: { status: finalStatus, pago_verificado_at: new Date() },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        user_id: auth.session.id,
        action: "ABONO",
        entity_type: "AccountReceivable",
        entity_id: params.id,
        data_before: {
          amount_paid_usd: Number(cuenta.amount_paid_usd),
          status: cuenta.status,
        },
        data_after: {
          abono,
          metodo_pago: metodo_pago.trim(),
          referencia: referencia?.trim() || null,
          amount_paid_usd: newPaid,
          amount_pending: newPending,
          status: newStatus,
        },
        ip_address: ip,
      },
    });

    return result;
  });

  return NextResponse.json({
    id: updated.id,
    amount_paid_usd: Number(updated.amount_paid_usd),
    amount_pending: newPending,
    status: updated.status,
  });
}
