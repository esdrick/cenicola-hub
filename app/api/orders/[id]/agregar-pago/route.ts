import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getClientIp } from "@/lib/api-auth";
import { normalizeReference } from "@/lib/order-utils";
import { paymentTypeToPricingMethod, resolveUnitPrice } from "@/lib/pricing";
import { getSetting } from "@/lib/settings";
import type { PaymentType } from "@/app/generated/prisma/client";

const ALLOWED_BY_METHOD: Record<"bcv" | "divisas", string> = {
  bcv: "Efectivo Bs, Transferencia, Pago Móvil",
  divisas: "Efectivo USD, Zelle, USDT",
};

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await withAuth();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  const { payment_type, amount_usd, payment_date, payment_time, reference, payment_photo, exchange_rate_id } = body;

  if (!payment_type) return NextResponse.json({ error: "Tipo de pago requerido" }, { status: 400 });
  const amt = parseFloat(amount_usd);
  if (isNaN(amt) || amt <= 0) return NextResponse.json({ error: "Monto inválido" }, { status: 400 });
  if (!payment_date) return NextResponse.json({ error: "Fecha de pago requerida" }, { status: 400 });

  const isEfectivo = (payment_type as PaymentType) === "efectivo_bs" || (payment_type as PaymentType) === "efectivo_usd";
  if (!isEfectivo && !reference?.trim()) {
    return NextResponse.json({ error: "Referencia requerida para este método de pago" }, { status: 400 });
  }

  // Fetch pricing thresholds before the transaction
  const [mayorThreshold, bundleThreshold] = await Promise.all([
    getSetting("mayor_threshold"),
    getSetting("bundle_threshold"),
  ]);

  const derivedMethod = paymentTypeToPricingMethod(payment_type as PaymentType);

  const ip = getClientIp(request);

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: params.id },
        include: { items: { include: { variant: true } } },
      });

      if (!order) throw new Error("NOT_FOUND");

      // Vendedoras can only add payments to their own orders
      const isRestricted = auth.session.role === "vendedora_online" || auth.session.role === "vendedora_tienda";
      if (isRestricted && order.created_by !== auth.session.id) throw new Error("FORBIDDEN");

      if (!["pendiente_pago", "pago_parcial"].includes(order.status)) {
        throw new Error("INVALID_STATUS");
      }

      // ── Handle pricing_method ────────────────────────────────────────────────
      let effectiveOrderTotal: number;

      if (order.pricing_method === null) {
        // First payment: recalculate item prices and set pricing_method on order
        const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);
        let newTotalUsd = 0;

        for (const item of order.items) {
          const unitPrice = resolveUnitPrice(
            item.variant,
            derivedMethod,
            totalItems,
            mayorThreshold,
            bundleThreshold,
          );
          const subtotal = parseFloat((Number(unitPrice) * item.quantity).toFixed(2));
          newTotalUsd += subtotal;
          await tx.orderItem.update({
            where: { id: item.id },
            data: { unit_price_usd: Number(unitPrice), subtotal_usd: subtotal },
          });
        }
        newTotalUsd = parseFloat(newTotalUsd.toFixed(2));

        await tx.order.update({
          where: { id: order.id },
          data: { pricing_method: derivedMethod, total_usd: newTotalUsd },
        });

        effectiveOrderTotal = newTotalUsd;
      } else {
        // Subsequent payments: validate compatibility with established pricing_method
        if (derivedMethod !== order.pricing_method) {
          throw new Error(`INCOMPATIBLE_PAYMENT:${order.pricing_method}`);
        }
        effectiveOrderTotal = Number(order.total_usd);
      }

      // ── Current paid total (for status updates + overpayment cap) ───────────
      const activePayments = await tx.orderPayment.findMany({
        where: { order_id: order.id, status: { not: "rechazado" } },
        select: { amount_usd: true },
      });
      const currentPaid = activePayments.reduce((s, p) => s + Number(p.amount_usd), 0);

      // Cap: total paid (including this payment) cannot exceed order total + $2 rounding margin
      if (currentPaid + amt > effectiveOrderTotal + 2.00) {
        throw new Error("OVERPAYMENT");
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

      // Cash is immediately verified — no admin confirmation needed
      const paymentStatus = isEfectivo ? "verificado" : "pendiente";

      // Resolve exchange rate: prefer client-supplied ID, fall back to today's in DB
      let resolvedRateId: string | null = exchange_rate_id ?? null;
      let amountVes: number | null = null;

      if (!resolvedRateId) {
        const todayRate = await tx.exchangeRate.findFirst({
          where: { rate_date: new Date(`${today}T00:00:00.000Z`) },
          select: { id: true, usd_to_ves: true },
        });
        if (todayRate) resolvedRateId = todayRate.id;
      }

      if (resolvedRateId) {
        const rateRecord = await tx.exchangeRate.findUnique({
          where: { id: resolvedRateId },
          select: { usd_to_ves: true },
        });
        if (rateRecord) {
          amountVes = parseFloat((amt * Number(rateRecord.usd_to_ves)).toFixed(2));
        }
      }

      await tx.orderPayment.create({
        data: {
          order_id: order.id,
          payment_type: payment_type as PaymentType,
          amount_usd: parseFloat(amt.toFixed(2)),
          amount_ves: amountVes,
          exchange_rate_id: resolvedRateId,
          is_partial: false,
          payment_date: new Date(payment_date || today),
          payment_time: payment_time || null,
          reference: isEfectivo ? "EFECTIVO" : (reference?.trim() ?? ""),
          reference_hash: hash,
          payment_photo: payment_photo?.trim() || null,
          status: paymentStatus,
        },
      });

      // For cash payments, auto-update order status based on new paid total
      if (isEfectivo) {
        const newPaidTotal = currentPaid + amt;
        const isFullyPaid = newPaidTotal >= effectiveOrderTotal - 0.005;
        let newOrderStatus: string | null = null;

        if (isFullyPaid) {
          // Tienda is direct sale → completada immediately
          // Online still needs shipping → pago_verificado
          newOrderStatus = order.channel === "tienda" ? "completada" : "pago_verificado";
        } else if (order.status === "pendiente_pago") {
          newOrderStatus = "pago_parcial";
        }

        if (newOrderStatus) {
          await tx.order.update({
            where: { id: order.id },
            data: { status: newOrderStatus as never },
          });
        }

        // When going to pago_parcial, create/update AccountReceivable
        if (newOrderStatus === "pago_parcial") {
          const remainingDebt = parseFloat((effectiveOrderTotal - (currentPaid + amt)).toFixed(2));
          if (remainingDebt > 0) {
            const existing = await tx.accountReceivable.findFirst({
              where: { order_id: order.id },
            });
            if (existing) {
              await tx.accountReceivable.update({
                where: { id: existing.id },
                data: { amount_usd: remainingDebt, status: "pendiente" },
              });
            } else {
              await tx.accountReceivable.create({
                data: {
                  description: `Saldo pendiente - Orden ${order.order_number}`,
                  debtor_name: `${order.customer_name} ${order.customer_lastname}`,
                  amount_usd: remainingDebt,
                  amount_paid_usd: 0,
                  due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                  status: "pendiente",
                  order_id: order.id,
                  created_by: auth.session.id,
                },
              });
            }
          }
        }
      }

      await tx.auditLog.create({
        data: {
          user_id: auth.session.id,
          action: "pago_agregado",
          entity_type: "Order",
          entity_id: order.id,
          data_before: { status: order.status, pricing_method: order.pricing_method },
          data_after: {
            payment_type,
            amount_usd: amt,
            reference: isEfectivo ? "EFECTIVO" : reference,
            auto_verified: isEfectivo,
            pricing_method_set: derivedMethod,
          },
          ip_address: ip,
        },
      });
    }, { isolationLevel: "Serializable" });

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
    if (msg.startsWith("INCOMPATIBLE_PAYMENT:")) {
      const method = msg.replace("INCOMPATIBLE_PAYMENT:", "") as "bcv" | "divisas";
      return NextResponse.json(
        { error: `Método de pago incompatible. Esta orden usa precios ${method === "bcv" ? "BCV" : "divisas"} — métodos permitidos: ${ALLOWED_BY_METHOD[method]}` },
        { status: 422 }
      );
    }
    if (msg === "OVERPAYMENT")
      return NextResponse.json(
        { error: "El monto excede el total de la orden. Solo se permite hasta $2.00 de diferencia por redondeo." },
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
