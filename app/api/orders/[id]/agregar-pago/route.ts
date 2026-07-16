import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, getClientIp } from "@/lib/api-auth";
import { normalizeReference } from "@/lib/order-utils";
import { paymentTypeToPricingMethod } from "@/lib/pricing";
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
  if (!isEfectivo) {
    const refLength = reference?.trim().length ?? 0;
    if (refLength === 0) {
      return NextResponse.json({ error: "Referencia requerida para este método de pago" }, { status: 400 });
    }
    if (refLength < 6 || refLength > 30) {
      return NextResponse.json({ error: "La referencia debe tener entre 6 y 30 caracteres" }, { status: 400 });
    }
  }

  const derivedMethod = paymentTypeToPricingMethod(payment_type as PaymentType);

  const ip = getClientIp(request);

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: params.id } });

      if (!order) throw new Error("NOT_FOUND");

      // Vendedoras can only add payments to their own orders
      const isRestricted = auth.session.role === "vendedora_online" || auth.session.role === "vendedora_tienda";
      if (isRestricted && order.created_by !== auth.session.id) throw new Error("FORBIDDEN");

      if (!["pendiente_pago", "pago_parcial"].includes(order.status)) {
        throw new Error("INVALID_STATUS");
      }

      // The BCV/Divisas split (if any) only determines the order's total_usd — it doesn't
      // require paying each currency separately. An order priced in a single currency still
      // locks subsequent payments to that same method (unchanged); a genuinely split order
      // (both total_bcv_usd and total_divisas_usd > 0) accepts any method, as long as the
      // sum of all payments covers total_usd.
      const isSplitOrder = Number(order.total_bcv_usd) > 0 && Number(order.total_divisas_usd) > 0;
      if (!isSplitOrder) {
        if (order.pricing_method && derivedMethod !== order.pricing_method) {
          throw new Error(`INCOMPATIBLE_PAYMENT:${order.pricing_method}`);
        }
        // Legacy orders from before pricing_method existed (or before this order ever got a
        // pricing_method backfilled) — lock it to whatever currency this first payment uses,
        // same as every other single-currency order, instead of leaving it permanently open.
        if (!order.pricing_method) {
          await tx.order.update({ where: { id: order.id }, data: { pricing_method: derivedMethod } });
        }
      }

      const effectiveOrderTotal = Number(order.total_usd);

      // ── Current paid total (for status updates + overpayment cap) ───────────
      const activePayments = await tx.orderPayment.findMany({
        where: { order_id: order.id, status: { not: "rechazado" } },
        select: { amount_usd: true, payment_type: true, status: true },
      });
      const currentPaid = activePayments.reduce((s, p) => s + Number(p.amount_usd), 0);
      // Separate from currentPaid: only counts payments the business has actually confirmed
      // (verificado) — a pending transferencia/zelle/etc. counts toward the customer's balance
      // (currentPaid, used for the overpayment cap and the outstanding-debt tracking below) but
      // must NOT be treated as verified just because a later cash payment happens to push the
      // raw dollar sum over the total.
      const verifiedPaid = activePayments
        .filter((p) => p.status === "verificado")
        .reduce((s, p) => s + Number(p.amount_usd), 0);

      if (isSplitOrder) {
        // Per-currency cap AND floor on THIS payment's bucket — mirrors the same $1 rounding
        // margin as the overall cap, but against this payment's own bucket instead of the whole
        // order. The cap stops a single payment from overshooting what its currency needs (e.g.
        // $30 on a BCV payment when the order's BCV portion is only $20); the floor (checked
        // once this payment would fully close the order) stops the opposite — quietly paying
        // near the ceiling in one currency while barely touching the other, which would shift
        // real money from the currency the price assumed into the cheaper one to pay with.
        const paidBcvTotal = activePayments
          .filter((p) => paymentTypeToPricingMethod(p.payment_type) === "bcv")
          .reduce((s, p) => s + Number(p.amount_usd), 0) + (derivedMethod === "bcv" ? amt : 0);
        const paidDivisasTotal = activePayments
          .filter((p) => paymentTypeToPricingMethod(p.payment_type) === "divisas")
          .reduce((s, p) => s + Number(p.amount_usd), 0) + (derivedMethod === "divisas" ? amt : 0);

        if (paidBcvTotal > Number(order.total_bcv_usd) + 1.00) throw new Error("BUCKET_OVERPAYMENT:bcv");
        if (paidDivisasTotal > Number(order.total_divisas_usd) + 1.00) throw new Error("BUCKET_OVERPAYMENT:divisas");

        const wouldBeFullyPaid = currentPaid + amt >= effectiveOrderTotal - 0.005;
        if (wouldBeFullyPaid) {
          if (paidBcvTotal < Number(order.total_bcv_usd) - 1.00) throw new Error("SPLIT_CURRENCY_MISMATCH:bcv");
          if (paidDivisasTotal < Number(order.total_divisas_usd) - 1.00) throw new Error("SPLIT_CURRENCY_MISMATCH:divisas");
        }
      }

      // Cap: total paid (including this payment) cannot exceed order total + $1 rounding margin
      if (currentPaid + amt > effectiveOrderTotal + 1.00) {
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
        // isFullyPaid gates advancing to pago_verificado/completada (i.e. "ready for embalaje")
        // so it must only count VERIFIED money — this cash payment (verified on arrival) plus
        // whatever was already verified. An older pending transferencia still awaiting manual
        // verification must not silently get treated as confirmed just because the totals add up.
        const isFullyPaid = verifiedPaid + amt >= effectiveOrderTotal - 0.005;
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
            data: {
              status: newOrderStatus as never,
              ...(isFullyPaid ? { pago_verificado_at: new Date() } : {}),
            },
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
          data_before: { status: order.status },
          data_after: {
            payment_type,
            amount_usd: amt,
            reference: isEfectivo ? "EFECTIVO" : reference,
            auto_verified: isEfectivo,
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
    if (msg.startsWith("SPLIT_CURRENCY_MISMATCH:")) {
      const method = msg.replace("SPLIT_CURRENCY_MISMATCH:", "") as "bcv" | "divisas";
      return NextResponse.json(
        { error: `Esta orden está dividida entre BCV y Divisas — falta cubrir la parte de ${method === "bcv" ? "BCV" : "Divisas"} con pagos de esa moneda (no se puede compensar con la otra).` },
        { status: 422 }
      );
    }
    if (msg.startsWith("BUCKET_OVERPAYMENT:")) {
      const method = msg.replace("BUCKET_OVERPAYMENT:", "") as "bcv" | "divisas";
      return NextResponse.json(
        { error: `El monto excede lo que corresponde a ${method === "bcv" ? "BCV" : "Divisas"} en esta orden (con margen de redondeo de $1).` },
        { status: 422 }
      );
    }
    if (msg.startsWith("INCOMPATIBLE_PAYMENT:")) {
      const method = msg.replace("INCOMPATIBLE_PAYMENT:", "") as "bcv" | "divisas";
      return NextResponse.json(
        { error: `Método de pago incompatible. Esta orden usa precios ${method === "bcv" ? "BCV" : "divisas"} — métodos permitidos: ${ALLOWED_BY_METHOD[method]}` },
        { status: 422 }
      );
    }
    if (msg === "OVERPAYMENT")
      return NextResponse.json(
        { error: "El monto excede el total de la orden. Solo se permite hasta $1.00 de diferencia por redondeo." },
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
