import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withRole } from "@/lib/api-auth";
import { getOrderCategory } from "@/lib/order-utils";

export async function GET(request: NextRequest) {
  const auth = await withRole(["admin"]);
  if (!auth.ok) return auth.response;

  const sp = request.nextUrl.searchParams;
  const desde = sp.get("desde");
  const hasta = sp.get("hasta");

  const orderDateFilter =
    desde && hasta
      ? { gte: new Date(desde), lte: new Date(`${hasta}T23:59:59`) }
      : desde
      ? { gte: new Date(desde) }
      : hasta
      ? { lte: new Date(`${hasta}T23:59:59`) }
      : undefined;

  const expenseDateFilter =
    desde && hasta
      ? { gte: new Date(desde), lte: new Date(hasta) }
      : desde
      ? { gte: new Date(desde) }
      : hasta
      ? { lte: new Date(hasta) }
      : undefined;

  const [ordenesCompletadas, gastos, cobrar, pagar, pagosPendientes, ingresosPorMetodo, montoPorConfirmar] =
    await Promise.all([
      prisma.order.findMany({
        where: {
          status: "completada",
          ...(orderDateFilter && { created_at: orderDateFilter }),
        },
        select: {
          total_usd: true,
          channel: true,
          order_number: true,
          created_by: true,
          notes: true,
        },
      }),
      prisma.expense.aggregate({
        where: {
          ...(expenseDateFilter && { expense_date: expenseDateFilter }),
        },
        _sum: { amount_usd: true },
      }),
      prisma.accountReceivable.findMany({
        where: { status: { in: ["pendiente", "cobrado_parcial"] } },
        select: { amount_usd: true, amount_paid_usd: true },
      }),
      prisma.accountPayable.findMany({
        where: { status: "pendiente" },
        select: { monto: true },
      }),
      prisma.order.count({
        where: { status: { in: ["pendiente_pago", "pago_parcial"] } },
      }),
      prisma.orderPayment.groupBy({
        by: ["payment_type"],
        where: {
          status: "verificado",
          ...(orderDateFilter && { verified_at: orderDateFilter }),
        },
        _sum: { amount_usd: true },
        _count: { id: true },
      }),
      prisma.orderPayment.aggregate({
        where: { status: "pendiente" },
        _sum: { amount_usd: true },
        _count: { id: true },
      }),
    ]);

  let ventasTienda = 0;
  let countTienda = 0;
  let ventasOnline = 0;
  let countOnline = 0;
  let ventasWeb = 0;
  let countWeb = 0;

  for (const o of ordenesCompletadas) {
    const cat = getOrderCategory(o);
    const val = Number(o.total_usd);
    if (cat === "web") {
      ventasWeb += val;
      countWeb++;
    } else if (cat === "online") {
      ventasOnline += val;
      countOnline++;
    } else {
      ventasTienda += val;
      countTienda++;
    }
  }

  const totalCobrar = cobrar.reduce(
    (s, r) => s + Number(r.amount_usd) - Number(r.amount_paid_usd),
    0
  );
  const totalPagar = pagar.reduce((s, p) => s + Number(p.monto), 0);

  const totalVentas = ventasTienda + ventasOnline + ventasWeb;
  const totalOrdenes = countTienda + countOnline + countWeb;

  return NextResponse.json({
    ventas: totalVentas,
    ordenes_completadas: totalOrdenes,
    ventas_por_canal: {
      tienda: { total: ventasTienda, count: countTienda },
      online: { total: ventasOnline, count: countOnline },
      web: { total: ventasWeb, count: countWeb },
    },
    gastos: Number(gastos._sum.amount_usd ?? 0),
    cobrar: totalCobrar,
    pagar: totalPagar,
    pagos_pendientes: pagosPendientes,
    monto_por_confirmar: Number(montoPorConfirmar._sum.amount_usd ?? 0),
    pagos_por_confirmar_count: montoPorConfirmar._count.id,
    ingresos_por_metodo: ingresosPorMetodo.map((m) => ({
      metodo: m.payment_type,
      total: Number(m._sum.amount_usd ?? 0),
      count: m._count.id,
    })),
  });
}
